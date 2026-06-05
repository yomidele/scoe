import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedLecturer } from "@/components/ProtectedLecturer";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { lecturerSubmitResults } from "@/lib/result-workflow.functions";

const Search = z.object({ assignment_id: z.string().uuid().optional() });

export const Route = createFileRoute("/lecturer/entry")({
  head: () => ({ meta: [{ title: "Score Entry — Lecturer" }] }),
  validateSearch: (s) => Search.parse(s),
  component: () => <ProtectedLecturer><Page /></ProtectedLecturer>,
});

function Page() {
  const { assignment_id } = Route.useSearch();
  const qc = useQueryClient();
  const submit = useServerFn(lecturerSubmitResults);
  const [draft, setDraft] = useState<Record<string, { ca: string; exam: string }>>({});

  const assignmentQ = useQuery({
    queryKey: ["assignment", assignment_id], enabled: !!assignment_id,
    queryFn: async () => (await supabase.from("course_assignments")
      .select("id, lecturer_id, course_id, session_id, semester, department_id, faculty_id, courses(code, title, level), academic_sessions(name)")
      .eq("id", assignment_id!).maybeSingle()).data,
  });

  const studentsQ = useQuery({
    queryKey: ["assignment-students", assignmentQ.data?.id], enabled: !!assignmentQ.data,
    queryFn: async () => {
      const a = assignmentQ.data!;
      const { data } = await supabase.from("students")
        .select("id, matric_number, full_name")
        .eq("department_id", a.department_id)
        .eq("level", (a.courses as any)?.level)
        .order("matric_number");
      return data ?? [];
    },
  });

  const existingQ = useQuery({
    queryKey: ["assignment-results", assignmentQ.data?.id], enabled: !!assignmentQ.data,
    queryFn: async () => {
      const a = assignmentQ.data!;
      const { data } = await supabase.from("results")
        .select("id, student_id, ca_score, exam_score, total_score, status")
        .eq("course_id", a.course_id).eq("session_id", a.session_id).eq("semester", a.semester);
      return data ?? [];
    },
  });

  const byStudent = useMemo(() => {
    const m: Record<string, any> = {};
    (existingQ.data ?? []).forEach((r: any) => { m[r.student_id] = r; });
    return m;
  }, [existingQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const a = assignmentQ.data!;
      const rows = Object.entries(draft)
        .filter(([_, v]) => v.ca !== "" || v.exam !== "")
        .map(([student_id, v]) => ({
          student_id,
          course_id: a.course_id,
          session_id: a.session_id,
          semester: a.semester,
          level: (a.courses as any)?.level,
          ca_score: Number(v.ca || 0),
          exam_score: Number(v.exam || 0),
          status: "draft",
          faculty_id: a.faculty_id,
          department_id: a.department_id,
        }));
      if (!rows.length) throw new Error("Enter at least one score");
      const { error } = await supabase.from("results").upsert(rows, { onConflict: "student_id,course_id,session_id,semester" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved as draft"); setDraft({}); qc.invalidateQueries({ queryKey: ["assignment-results"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const ids = (existingQ.data ?? []).filter((r: any) => r.status === "draft").map((r: any) => r.id);
      if (!ids.length) throw new Error("No draft results to submit. Save first.");
      return submit({ data: { result_ids: ids } });
    },
    onSuccess: () => { toast.success("Submitted to Department Admin"); qc.invalidateQueries({ queryKey: ["assignment-results"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!assignment_id) return <p className="text-sm text-muted-foreground">Pick a course from your dashboard.</p>;
  if (!assignmentQ.data) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  const a = assignmentQ.data;
  const course = a.courses as any;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">{course?.code} — {course?.title}</h2>
        <p className="text-sm text-muted-foreground">Level {course?.level} · {a.semester} · {(a.academic_sessions as any)?.name}</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Enter scores</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save draft</Button>
            <Button size="sm" variant="secondary" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>Submit for approval</Button>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Matric</th><th className="py-2 pr-3">Student</th><th className="py-2 pr-3 w-24">CA</th><th className="py-2 pr-3 w-24">Exam</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Status</th></tr></thead>
            <tbody>
              {(studentsQ.data ?? []).map((s) => {
                const existing = byStudent[s.id];
                const d = draft[s.id] ?? { ca: existing?.ca_score?.toString() ?? "", exam: existing?.exam_score?.toString() ?? "" };
                const total = (Number(d.ca || 0) + Number(d.exam || 0)) || existing?.total_score || 0;
                const locked = existing && existing.status !== "draft";
                return (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-3">{s.matric_number}</td>
                    <td className="py-2 pr-3">{s.full_name}</td>
                    <td className="py-2 pr-3"><Input type="number" min={0} max={40} disabled={locked} value={d.ca} onChange={(e) => setDraft((p) => ({ ...p, [s.id]: { ca: e.target.value, exam: d.exam } }))} /></td>
                    <td className="py-2 pr-3"><Input type="number" min={0} max={60} disabled={locked} value={d.exam} onChange={(e) => setDraft((p) => ({ ...p, [s.id]: { ca: d.ca, exam: e.target.value } }))} /></td>
                    <td className="py-2 pr-3 font-medium">{total}</td>
                    <td className="py-2 pr-3 text-xs uppercase">{existing?.status ?? "—"}</td>
                  </tr>
                );
              })}
              {(studentsQ.data ?? []).length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No students at this level in your department.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
