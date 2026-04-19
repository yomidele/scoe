import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeGrade, classOfDegree, effectiveTotal } from "@/lib/grading";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/transcripts")({
  head: () => ({ meta: [{ title: "Transcripts — SCOE" }] }),
  component: () => <ProtectedAdmin><TranscriptsPage /></ProtectedAdmin>,
});

const LEVELS = [100, 200, 300, 400] as const;
const SEMESTERS = ["First", "Second"] as const;
const SEM_ORDER: Record<string, number> = { First: 1, Second: 2 };

interface ResultRow {
  id: string;
  level: number;
  semester: string;
  ca_score: number;
  exam_score: number;
  total_score: number | null;
  session_id: string;
  courses: { code: string; title: string; unit: number } | null;
  academic_sessions: { name: string } | null;
}

function TranscriptsPage() {
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [startSession, setStartSession] = useState("");
  const [startLevel, setStartLevel] = useState("100");
  const [startSem, setStartSem] = useState("First");
  const [endSession, setEndSession] = useState("");
  const [endLevel, setEndLevel] = useState("400");
  const [endSem, setEndSem] = useState("Second");

  const { data: students = [] } = useQuery({
    queryKey: ["students-all"],
    queryFn: async () => (await supabase.from("students").select("*").order("matric_number")).data ?? [],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await supabase.from("academic_sessions").select("*").order("name")).data ?? [],
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 20);
    return students.filter((s) => s.full_name.toLowerCase().includes(q) || s.matric_number.toLowerCase().includes(q)).slice(0, 20);
  }, [students, search]);

  const student = students.find((s) => s.id === studentId);

  const { data: allResults = [] } = useQuery<ResultRow[]>({
    queryKey: ["transcript-results", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("results")
        .select("id, level, semester, ca_score, exam_score, total_score, session_id, courses(code, title, unit), academic_sessions(name)")
        .eq("student_id", studentId);
      if (error) throw error;
      return (data ?? []) as unknown as ResultRow[];
    },
  });

  const sessionRank = (id: string) => {
    const name = sessions.find((s) => s.id === id)?.name ?? "";
    return name; // names like "2021/2022" sort lexically
  };

  const inRange = (r: ResultRow): boolean => {
    if (!startSession || !endSession) return true;
    const rSess = sessionRank(r.session_id);
    const sSess = sessionRank(startSession);
    const eSess = sessionRank(endSession);
    const key = (sess: string, lvl: number, sem: string) => `${sess}|${lvl}|${SEM_ORDER[sem] ?? 0}`;
    const k = key(rSess, r.level, r.semester);
    const ks = key(sSess, Number(startLevel), startSem);
    const ke = key(eSess, Number(endLevel), endSem);
    return k >= ks && k <= ke;
  };

  const inRangeResults = useMemo(() => allResults.filter(inRange), [allResults, startSession, endSession, startLevel, endLevel, startSem, endSem]);

  // Group by session+semester+level
  const groups = useMemo(() => {
    const m = new Map<string, { sessionName: string; level: number; semester: string; rows: ResultRow[] }>();
    for (const r of inRangeResults) {
      const sn = r.academic_sessions?.name ?? "—";
      const k = `${sn}__${r.level}__${r.semester}`;
      if (!m.has(k)) m.set(k, { sessionName: sn, level: r.level, semester: r.semester, rows: [] });
      m.get(k)!.rows.push(r);
    }
    return Array.from(m.values()).sort((a, b) => {
      if (a.sessionName !== b.sessionName) return a.sessionName.localeCompare(b.sessionName);
      if (a.level !== b.level) return a.level - b.level;
      return (SEM_ORDER[a.semester] ?? 0) - (SEM_ORDER[b.semester] ?? 0);
    });
  }, [inRangeResults]);

  const computeStats = (rows: ResultRow[]) => {
    let pts = 0, units = 0;
    for (const r of rows) {
      const u = r.courses?.unit ?? 0;
      const { point } = computeGrade(effectiveTotal(r));
      pts += point * u; units += u;
    }
    return { pts, units, gpa: units ? pts / units : 0 };
  };

  const overall = useMemo(() => computeStats(inRangeResults), [inRangeResults]);

  const validateRange = () => {
    if (!startSession || !endSession) return "Pick start and end sessions";
    const sKey = `${sessionRank(startSession)}|${Number(startLevel)}|${SEM_ORDER[startSem]}`;
    const eKey = `${sessionRank(endSession)}|${Number(endLevel)}|${SEM_ORDER[endSem]}`;
    if (sKey > eKey) return "Start must be before End";
    return null;
  };

  const handleGenerate = () => {
    if (!student) { toast.error("Select a student"); return; }
    const err = validateRange();
    if (err) { toast.error(err); return; }
    if (groups.length === 0) { toast.error("No results in selected range"); return; }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("SHALLOM COLLEGE OF EDUCATION, PAMBULA MICHIKA", pageW / 2, y, { align: "center" }); y += 18;
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text("Academic Transcript", pageW / 2, y, { align: "center" }); y += 22;

    doc.setFontSize(10);
    doc.text(`Student: ${student.full_name}`, 40, y);
    doc.text(`Matric No: ${student.matric_number}`, pageW - 40, y, { align: "right" }); y += 14;
    doc.text(`Department: ${student.department ?? "—"}`, 40, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - 40, y, { align: "right" }); y += 18;

    for (const g of groups) {
      const stats = computeStats(g.rows);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(`${g.sessionName}  ·  ${g.level} Level  ·  ${g.semester} Semester`, 40, y); y += 4;

      autoTable(doc, {
        startY: y + 4,
        head: [["Code", "Title", "Unit", "Score", "Grade", "Pt"]],
        body: g.rows
          .sort((a, b) => (a.courses?.code ?? "").localeCompare(b.courses?.code ?? ""))
          .map((r) => {
            const total = effectiveTotal(r);
            const gr = computeGrade(total);
            return [
              r.courses?.code ?? "",
              r.courses?.title ?? "",
              String(r.courses?.unit ?? 0),
              String(total),
              gr.grade,
              String(gr.point),
            ];
          }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [40, 60, 90] },
        margin: { left: 40, right: 40 },
      });
      // @ts-expect-error lastAutoTable injected by autotable
      y = doc.lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "italic"); doc.setFontSize(9);
      doc.text(`Semester GPA: ${stats.gpa.toFixed(2)}   ·   Units: ${stats.units}`, pageW - 40, y, { align: "right" });
      y += 18;
      if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 40; }
    }

    // Footer
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 40; }
    doc.setDrawColor(180); doc.line(40, y, pageW - 40, y); y += 16;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`CGPA: ${overall.gpa.toFixed(2)}`, 40, y);
    doc.text(`Total Units: ${overall.units}`, pageW / 2, y, { align: "center" });
    doc.text(`Class: ${classOfDegree(overall.gpa)}`, pageW - 40, y, { align: "right" });

    doc.save(`transcript_${student.matric_number.replace(/[\/\\]/g, "_")}.pdf`);
    toast.success("Transcript downloaded");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Transcripts</h2>
        <p className="text-sm text-muted-foreground">Generate a PDF transcript for any student across a chosen academic range.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">1. Select Student</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Search by name or matric</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Ahmed or SCOE/EDU/24/001" />
            </div>
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder={`${filteredStudents.length} match(es)`} /></SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.matric_number} — {s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">2. Range</CardTitle>
          <CardDescription>Define the start and end of the transcript window.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Start</p>
            <RangePicker session={startSession} setSession={setStartSession} level={startLevel} setLevel={setStartLevel} semester={startSem} setSemester={setStartSem} sessions={sessions} />
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">End</p>
            <RangePicker session={endSession} setSession={setEndSession} level={endLevel} setLevel={setEndLevel} semester={endSem} setSemester={setEndSem} sessions={sessions} />
          </div>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">3. Preview & Generate</CardTitle>
            <CardDescription>{groups.length} semester group(s) · CGPA {overall.gpa.toFixed(2)} · {overall.units} units</CardDescription>
          </div>
          <Button onClick={handleGenerate} disabled={!student || groups.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Generate PDF
          </Button>
        </CardHeader>
        <CardContent>
          {!student && <p className="text-sm text-muted-foreground">Select a student to preview.</p>}
          {student && groups.length === 0 && <p className="text-sm text-muted-foreground">No results found in the selected range.</p>}
          {student && groups.length > 0 && (
            <ul className="space-y-1 text-sm">
              {groups.map((g, i) => {
                const s = computeStats(g.rows);
                return (
                  <li key={i} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                    <span>{g.sessionName} · {g.level}L · {g.semester} Sem</span>
                    <span className="text-xs text-muted-foreground">{g.rows.length} courses · GPA {s.gpa.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RangePicker({ session, setSession, level, setLevel, semester, setSemester, sessions }: {
  session: string; setSession: (v: string) => void;
  level: string; setLevel: (v: string) => void;
  semester: string; setSemester: (v: string) => void;
  sessions: { id: string; name: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Select value={session} onValueChange={setSession}>
        <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
        <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={level} onValueChange={setLevel}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={String(l)}>{l}L</SelectItem>)}</SelectContent>
      </Select>
      <Select value={semester} onValueChange={setSemester}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
