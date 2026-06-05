import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedDeptAdmin } from "@/components/ProtectedDeptAdmin";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/dept-admin/assignments")({
  head: () => ({ meta: [{ title: "Course Assignments — Department Admin" }] }),
  component: () => <ProtectedDeptAdmin><Page /></ProtectedDeptAdmin>,
});

function Page() {
  const qc = useQueryClient();
  const { session } = useAuthSession();
  const [form, setForm] = useState({ lecturer_id: "", course_id: "", session_id: "", semester: "First" });

  const scopeQ = useQuery({
    queryKey: ["dept-admin-scope", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("department_admins").select("department_id, faculty_id").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const lecturers = useQuery({ queryKey: ["dept-lecturers"], queryFn: async () => (await supabase.from("lecturers").select("id, full_name").order("full_name")).data ?? [] });
  const courses = useQuery({ queryKey: ["dept-courses"], queryFn: async () => (await supabase.from("courses").select("id, code, title, level, semester").order("level").order("code")).data ?? [] });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("academic_sessions").select("id, name").order("created_at", { ascending: false })).data ?? [] });

  const assignmentsQ = useQuery({
    queryKey: ["dept-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("course_assignments")
        .select("id, semester, lecturer_id, course_id, session_id, lecturers(full_name), courses(code, title), academic_sessions(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!scopeQ.data) throw new Error("Loading scope…");
      const { error } = await supabase.from("course_assignments").insert({
        lecturer_id: form.lecturer_id, course_id: form.course_id, session_id: form.session_id, semester: form.semester,
        department_id: scopeQ.data.department_id, faculty_id: scopeQ.data.faculty_id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assignment created"); setForm({ lecturer_id: "", course_id: "", session_id: "", semester: "First" }); qc.invalidateQueries({ queryKey: ["dept-assignments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("course_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["dept-assignments"] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Course Assignments</h2>
        <p className="text-sm text-muted-foreground">Assign lecturers to courses for a session and semester.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">New assignment</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
            <div><Label>Lecturer</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.lecturer_id} onChange={(e) => setForm({ ...form, lecturer_id: e.target.value })} required>
                <option value="">Select</option>{lecturers.data?.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>
            <div><Label>Course</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} required>
                <option value="">Select</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title} (L{c.level})</option>)}
              </select>
            </div>
            <div><Label>Session</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })} required>
                <option value="">Select</option>{sessions.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><Label>Semester</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="First">First</option><option value="Second">Second</option>
              </select>
            </div>
            <div className="md:col-span-4"><Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Existing assignments</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Lecturer</th><th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Session</th><th className="py-2 pr-3">Semester</th><th></th></tr></thead>
            <tbody>
              {assignmentsQ.data?.map((a: any) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 pr-3">{a.lecturers?.full_name}</td>
                  <td className="py-2 pr-3">{a.courses?.code} — {a.courses?.title}</td>
                  <td className="py-2 pr-3">{a.academic_sessions?.name}</td>
                  <td className="py-2 pr-3">{a.semester}</td>
                  <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove assignment?")) removeMut.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {(!assignmentsQ.data || assignmentsQ.data.length === 0) && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No assignments yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
