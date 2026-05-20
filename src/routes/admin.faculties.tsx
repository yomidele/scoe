import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/admin/faculties")({
  head: () => ({ meta: [{ title: "Faculties — Super Admin" }] }),
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
  return <FacultiesPage />;
}

function FacultiesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const facultiesQ = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faculties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const deptsQ = useQuery({
    queryKey: ["departments-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createFaculty = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("faculties").insert({ name: name.trim(), code: code.trim().toUpperCase() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faculty created");
      setName("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["faculties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFaculty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faculties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faculty removed");
      qc.invalidateQueries({ queryKey: ["faculties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Faculties</h2>
        <p className="text-sm text-muted-foreground">Super Admin — manage university faculties.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add new faculty</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[2fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !code.trim()) return;
              createFaculty.mutate();
            }}
          >
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faculty of Education" required />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EDU" required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createFaculty.isPending} className="w-full md:w-auto">
                {createFaculty.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Faculty
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All faculties</CardTitle></CardHeader>
        <CardContent>
          {facultiesQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Departments</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(facultiesQ.data ?? []).map((f) => {
                    const deptCount = (deptsQ.data ?? []).filter((d) => d.faculty_id === f.id).length;
                    return (
                      <tr key={f.id} className="border-b">
                        <td className="py-2 pr-3 font-medium">{f.name}</td>
                        <td className="py-2 pr-3">{f.code}</td>
                        <td className="py-2 pr-3">{deptCount}</td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete ${f.name}? This will fail if students/courses are still attached.`)) {
                                deleteFaculty.mutate(f.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {(facultiesQ.data ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No faculties yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DepartmentsCard faculties={facultiesQ.data ?? []} departments={deptsQ.data ?? []} />
    </div>
  );
}

function DepartmentsCard({
  faculties,
  departments,
}: {
  faculties: Array<{ id: string; name: string; code: string }>;
  departments: Array<{ id: string; faculty_id: string; name: string; code: string }>;
}) {
  const qc = useQueryClient();
  const [facultyId, setFacultyId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const createDept = useMutation({
    mutationFn: async () => {
      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(cleanCode)) throw new Error("Code must be exactly 2 letters");
      const { error } = await supabase.from("departments").insert({
        faculty_id: facultyId,
        name: name.trim(),
        code: cleanCode,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department created");
      setName("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["departments-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department removed");
      qc.invalidateQueries({ queryKey: ["departments-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Departments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!facultyId || !name.trim() || !code.trim()) return;
            createDept.mutate();
          }}
        >
          <div>
            <Label>Faculty</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              required
            >
              <option value="">Select faculty</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Department name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Computer Science" required />
          </div>
          <div>
            <Label>Code (2 letters)</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())}
              placeholder="CS"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createDept.isPending} className="w-full md:w-auto">
              {createDept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Faculty</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const fac = faculties.find((f) => f.id === d.faculty_id);
                return (
                  <tr key={d.id} className="border-b">
                    <td className="py-2 pr-3">{fac?.name ?? "—"}</td>
                    <td className="py-2 pr-3 font-medium">{d.name}</td>
                    <td className="py-2 pr-3">{d.code}</td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete ${d.name}?`)) deleteDept.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {departments.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No departments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
