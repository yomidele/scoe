import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedDeptAdmin } from "@/components/ProtectedDeptAdmin";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { createLecturer, deleteLecturer } from "@/lib/admin-users.functions";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/dept-admin/lecturers")({
  head: () => ({ meta: [{ title: "Lecturers — Department Admin" }] }),
  component: () => <ProtectedDeptAdmin><Page /></ProtectedDeptAdmin>,
});

function Page() {
  const qc = useQueryClient();
  const { session } = useAuthSession();
  const create = useServerFn(createLecturer);
  const remove = useServerFn(deleteLecturer);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  const selfQ = useQuery({
    queryKey: ["dept-admin-scope", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("department_admins").select("department_id, faculty_id").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const lecturersQ = useQuery({
    queryKey: ["dept-lecturers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lecturers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!selfQ.data) throw new Error("Loading scope…");
      return create({ data: { ...form, department_id: selfQ.data.department_id } });
    },
    onSuccess: () => {
      toast.success("Lecturer created");
      setForm({ email: "", password: "", full_name: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["dept-lecturers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => { toast.success("Lecturer removed"); qc.invalidateQueries({ queryKey: ["dept-lecturers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Lecturers</h2>
        <p className="text-sm text-muted-foreground">Create login accounts for lecturers in your department.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Add lecturer</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
            <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Temporary password</Label><Input minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div className="flex items-end"><Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Lecturer</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">All lecturers</CardTitle></CardHeader>
        <CardContent>
          {lecturersQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Phone</th><th></th></tr></thead>
              <tbody>
                {(lecturersQ.data ?? []).map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-2 pr-3 font-medium">{l.full_name}</td>
                    <td className="py-2 pr-3">{l.email}</td>
                    <td className="py-2 pr-3">{l.phone ?? "—"}</td>
                    <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${l.full_name}?`)) removeMut.mutate(l.user_id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
                {(lecturersQ.data ?? []).length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No lecturers yet.</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
