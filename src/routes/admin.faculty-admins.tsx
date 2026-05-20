import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useRole } from "@/hooks/use-role";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { createFacultyAdmin, deleteFacultyAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/faculty-admins")({
  head: () => ({ meta: [{ title: "Faculty Admins — Super Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <Page />
    </ProtectedAdmin>
  ),
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <FacultyAdminsPage />;
}

function FacultyAdminsPage() {
  const qc = useQueryClient();
  const create = useServerFn(createFacultyAdmin);
  const remove = useServerFn(deleteFacultyAdmin);

  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", faculty_id: "" });

  const facultiesQ = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faculties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const adminsQ = useQuery({
    queryKey: ["faculty-admins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faculty_admins")
        .select("*, faculties(name, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      return create({
        data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          faculty_id: form.faculty_id,
        },
      });
    },
    onSuccess: () => {
      toast.success("Faculty admin created");
      setForm({ email: "", password: "", full_name: "", phone: "", faculty_id: "" });
      qc.invalidateQueries({ queryKey: ["faculty-admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Faculty admin removed");
      qc.invalidateQueries({ queryKey: ["faculty-admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Faculty Admins</h2>
        <p className="text-sm text-muted-foreground">Create login accounts for faculty administrators.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add faculty admin</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.email || !form.password || !form.full_name || !form.faculty_id) return;
              createMut.mutate();
            }}
          >
            <div>
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <Label>Faculty</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.faculty_id}
                onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}
                required
              >
                <option value="">Select faculty</option>
                {(facultiesQ.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Temporary password</Label>
              <Input type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Faculty Admin
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All faculty admins</CardTitle></CardHeader>
        <CardContent>
          {adminsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Faculty</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(adminsQ.data ?? []).map((a: any) => (
                    <tr key={a.id} className="border-b">
                      <td className="py-2 pr-3 font-medium">{a.full_name}</td>
                      <td className="py-2 pr-3">{a.email}</td>
                      <td className="py-2 pr-3">{a.faculties?.name ?? "—"}</td>
                      <td className="py-2 pr-3">{a.phone ?? "—"}</td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={removeMut.isPending}
                          onClick={() => {
                            if (confirm(`Remove ${a.full_name}? Their login will be deleted.`)) {
                              removeMut.mutate(a.user_id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(adminsQ.data ?? []).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No faculty admins yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
