import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeGrade, classOfDegree, effectiveTotal } from "@/lib/grading";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "View / Export Results — SCOE" }] }),
  component: () => <ProtectedAdmin><ResultsViewPage /></ProtectedAdmin>,
});

const LEVELS = [100, 200, 300, 400] as const;
const SEMESTERS = ["First", "Second"] as const;

interface ResultJoined {
  id: string;
  student_id: string;
  course_id: string;
  ca_score: number;
  exam_score: number;
  total_score: number | null;
  semester: string;
  session_id: string;
  level: number;
  students: { matric_number: string; full_name: string } | null;
  courses: { code: string; title: string; unit: number } | null;
  academic_sessions: { name: string } | null;
}

function ResultsViewPage() {
  const [sessionId, setSessionId] = useState("");
  const [semester, setSemester] = useState("First");
  const [level, setLevel] = useState("100");

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await supabase.from("academic_sessions").select("*").order("name", { ascending: false })).data ?? [],
  });

  const { data: results = [], isLoading } = useQuery<ResultJoined[]>({
    queryKey: ["results", sessionId, semester, level],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, student_id, course_id, session_id, level, semester, ca_score, exam_score, total_score, students(matric_number, full_name), courses(code, title, unit), academic_sessions(name)")
        .eq("session_id", sessionId)
        .eq("semester", semester)
        .eq("level", Number(level));
      if (error) throw error;
      return (data ?? []) as unknown as ResultJoined[];
    },
  });

  // All historical results for selected students (for CGPA)
  const studentIds = useMemo(() => Array.from(new Set(results.map((r) => r.student_id))), [results]);

  const { data: allHistory = [] } = useQuery<ResultJoined[]>({
    queryKey: ["history", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, student_id, course_id, session_id, level, semester, ca_score, exam_score, total_score, courses(code, title, unit)")
        .in("student_id", studentIds);
      if (error) throw error;
      return (data ?? []) as unknown as ResultJoined[];
    },
  });

  // Group results by student for current view
  const grouped = useMemo(() => {
    const m = new Map<string, { matric: string; name: string; rows: ResultJoined[] }>();
    for (const r of results) {
      const key = r.student_id;
      if (!m.has(key)) m.set(key, { matric: r.students?.matric_number ?? "—", name: r.students?.full_name ?? "—", rows: [] });
      m.get(key)!.rows.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].matric.localeCompare(b[1].matric));
  }, [results]);

  const cgpaFor = (sid: string): { gpa: number; cgpa: number; tcu: number; tcp: number } => {
    // GPA for current view (this session+sem+level)
    const cur = results.filter((r) => r.student_id === sid);
    let gpaPts = 0, gpaUnits = 0;
    for (const r of cur) {
      const u = r.courses?.unit ?? 0;
      const { point } = computeGrade(Number(r.ca_score) + Number(r.exam_score));
      gpaPts += point * u; gpaUnits += u;
    }
    const gpa = gpaUnits ? gpaPts / gpaUnits : 0;

    // CGPA across all history
    const hist = allHistory.filter((r) => r.student_id === sid);
    let cPts = 0, cUnits = 0;
    for (const r of hist) {
      const u = r.courses?.unit ?? 0;
      const { point } = computeGrade(Number(r.ca_score) + Number(r.exam_score));
      cPts += point * u; cUnits += u;
    }
    const cgpa = cUnits ? cPts / cUnits : 0;
    return { gpa, cgpa, tcu: cUnits, tcp: cPts };
  };

  const handleExport = () => {
    if (grouped.length === 0) { toast.error("Nothing to export"); return; }
    const sessionName = sessions.find((s) => s.id === sessionId)?.name ?? "session";

    // Sheet 1: detailed result rows
    const detailRows = results.map((r) => {
      const total = Number(r.ca_score) + Number(r.exam_score);
      const { grade, point } = computeGrade(total);
      return {
        "Matric No": r.students?.matric_number ?? "",
        "Name": r.students?.full_name ?? "",
        "Course Code": r.courses?.code ?? "",
        "Course Title": r.courses?.title ?? "",
        "Unit": r.courses?.unit ?? 0,
        "CA (40)": Number(r.ca_score),
        "Exam (70)": Number(r.exam_score),
        "Total (100)": total,
        "Grade": grade,
        "Point": point,
      };
    }).sort((a, b) => a["Matric No"].localeCompare(b["Matric No"]) || a["Course Code"].localeCompare(b["Course Code"]));

    // Sheet 2: GPA / CGPA summary
    const summary = grouped.map(([sid, info]) => {
      const { gpa, cgpa } = cgpaFor(sid);
      return {
        "Matric No": info.matric,
        "Name": info.name,
        "Courses": info.rows.length,
        "GPA": Number(gpa.toFixed(2)),
        "CGPA": Number(cgpa.toFixed(2)),
        "Class of Degree": classOfDegree(cgpa),
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Result Sheet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "GPA-CGPA Summary");
    const fname = `SCOE_Results_${sessionName.replace("/","-")}_${semester}_${level}L.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`Exported ${fname}`);
  };

  const sessionName = sessions.find((s) => s.id === sessionId)?.name;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">View &amp; Export Results</h2>
        <p className="text-sm text-muted-foreground">Pick a session, semester, and level to view the result sheet.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder={sessions.length ? "Select session" : "Create a session first"} /></SelectTrigger>
              <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s} Semester</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExport} className="w-full" disabled={grouped.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export to Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {!sessionId && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">Select a session to load results.</CardContent></Card>
      )}

      {sessionId && isLoading && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>
      )}

      {sessionId && !isLoading && grouped.length === 0 && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">No results recorded for this scope.</CardContent></Card>
      )}

      {grouped.length > 0 && (
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Result Sheet — {sessionName} · {semester} Semester · {level} Level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {grouped.map(([sid, info]) => {
              const { gpa, cgpa, tcu } = cgpaFor(sid);
              return (
                <div key={sid} className="rounded-md border border-border">
                  <div className="flex flex-col gap-1 border-b border-border bg-secondary/50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{info.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{info.matric}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Stat label="GPA" value={gpa.toFixed(2)} />
                      <Stat label="CGPA" value={cgpa.toFixed(2)} />
                      <Stat label="Total Units (cum.)" value={String(tcu)} />
                      <Stat label="Class" value={classOfDegree(cgpa)} />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-center">Unit</TableHead>
                          <TableHead className="text-center">CA</TableHead>
                          <TableHead className="text-center">Exam</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Grade</TableHead>
                          <TableHead className="text-center">Pt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {info.rows.map((r) => {
                          const total = Number(r.ca_score) + Number(r.exam_score);
                          const g = computeGrade(total);
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono">{r.courses?.code}</TableCell>
                              <TableCell>{r.courses?.title}</TableCell>
                              <TableCell className="text-center">{r.courses?.unit}</TableCell>
                              <TableCell className="text-center">{Number(r.ca_score)}</TableCell>
                              <TableCell className="text-center">{Number(r.exam_score)}</TableCell>
                              <TableCell className="text-center font-medium">{total}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${g.grade === "F" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>{g.grade}</span>
                              </TableCell>
                              <TableCell className="text-center">{g.point}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card px-3 py-1.5 text-center tsu-shadow">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-bold text-primary">{value}</p>
    </div>
  );
}
