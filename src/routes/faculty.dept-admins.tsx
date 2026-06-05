import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { useRole } from "@/hooks/use-role";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { createDepartmentAdmin, deleteDepartmentAdmin } from "@/lib/admin-users.functions";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/faculty/dept-admins")({
  head: () => ({ meta: [{ title: "Department Admins — Faculty" }] }),
  component: () => <ProtectedFaculty><Gate /></ProtectedFaculty>,
});

function Gate() {
  const { loading, isFacultyAdmin, isSuperAdmin } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isFacultyAdmin && !isSuperAdmin) return <Navigate to="/faculty/dashboard" />;
  return <Page />;
}

function Page() {
  const qc = useQueryClient();
  const { session } = useAuthSession();
  const create = useServerFn(createDepartmentAdmin);
  const remove = useServerFn(deleteDepartmentAdmin);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", department_id: "" });

  const me = useQuery({
    queryKey: ["faculty-admin-scope", session?.user.id], enabled: !!session,
    queryFn: async () => (await supabase.from("faculty_admins").select("faculty_id").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const departments = useQuery({
    queryKey: ["faculty-departments", me.data?.faculty_id], enabled: !!me.data,
    queryFn: async () => (await supabase.from("departments").select("id, name, code").eq("faculty_id", me.data!.faculty_id).order("name")).data ?? [],
  });

  const adminsQ = useQuery({
    queryKey: ["dept-admins"],
    queryFn: async () => {
      const { data } = await supabase.from("department_admins").select("*, departments(name, code)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!me.data) throw new Error("Loading…");
      return create({ data: { ...form, faculty_id: me.data.faculty_id } });
    },
    onSuccess: () => { toast.success("Department admin created"); setForm({ email: "", password: "", full_name: "", phone: "", department_id: "" }); qc.invalidateQueries({ queryKey: ["dept-admins"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["dept-admins"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Department Admins</h2>
        <p className="text-sm text-muted-foreground">Create login accounts for department administrators in your faculty.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Add department admin</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
            <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>Department</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required>
                <option value="">Select</option>{(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Temporary password</Label><Input minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div className="flex items-end"><Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">All department admins</CardTitle></CardHeader>
        <CardContent>
          {adminsQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Department</th><th className="py-2 pr-3">Phone</th><th></th></tr></thead>
              <tbody>
                {(adminsQ.data ?? []).map((a: any) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2 pr-3 font-medium">{a.full_name}</td>
                    <td className="py-2 pr-3">{a.email}</td>
                    <td className="py-2 pr-3">{a.departments?.name ?? "—"}</td>
                    <td className="py-2 pr-3">{a.phone ?? "—"}</td>
                    <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${a.full_name}?`)) removeMut.mutate(a.user_id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
                {(adminsQ.data ?? []).length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No department admins yet.</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
