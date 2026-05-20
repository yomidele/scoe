import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { createRegistrationLink, listRegistrationLinks, deleteRegistrationLink } from "@/lib/registration-links.functions";

export const Route = createFileRoute("/admin/registration-links")({
  head: () => ({ meta: [{ title: "Registration Links — SCOE" }] }),
  component: () => <ProtectedAdmin><AdminLinksPage /></ProtectedAdmin>,
});

function AdminLinksPage() {
  const qc = useQueryClient();
  const create = useServerFn(createRegistrationLink);
  const list = useServerFn(listRegistrationLinks);
  const del = useServerFn(deleteRegistrationLink);

  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("100");
  const [days, setDays] = useState("14");

  const { data: faculties = [] } = useQuery({
    queryKey: ["all-faculties"],
    queryFn: async () => (await supabase.from("faculties").select("*").order("name")).data ?? [],
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["depts-for-fac", facultyId],
    enabled: !!facultyId,
    queryFn: async () => (await supabase.from("departments").select("*").eq("faculty_id", facultyId).order("name")).data ?? [],
  });

  const { data: links = [] } = useQuery({ queryKey: ["reg-links-all"], queryFn: () => list() });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!facultyId || !departmentId) throw new Error("Pick faculty and department");
      return create({ data: { faculty_id: facultyId, department_id: departmentId, level: Number(level), expires_in_days: Number(days) } });
    },
    onSuccess: () => { toast.success("Link created"); qc.invalidateQueries({ queryKey: ["reg-links-all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["reg-links-all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/student/register?token=${token}`);
    toast.success("Registration link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">All Registration Links</h2>
        <p className="text-sm text-muted-foreground">Create student registration links across any faculty.</p>
      </div>
      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Generate a link</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Faculty</Label>
              <Select value={facultyId} onValueChange={(v) => { setFacultyId(v); setDepartmentId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder={facultyId ? "Select" : "Pick faculty first"} /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[100,200,300,400].map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expires (days)</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,3,7,14,30,60].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5">
              <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Generating…" : "Generate"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">All links</CardTitle><CardDescription>{links.length} total</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faculty</TableHead><TableHead>Department</TableHead><TableHead className="text-center">Level</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No links yet.</TableCell></TableRow>}
              {links.map((l) => {
                const expired = new Date(l.expires_at) < new Date();
                const status = l.used_at ? "Used" : expired ? "Expired" : "Active";
                return (
                  <TableRow key={l.id}>
                    <TableCell>{(l.faculties as { name?: string } | null)?.name}</TableCell>
                    <TableCell>{(l.departments as { name?: string } | null)?.name}</TableCell>
                    <TableCell className="text-center">{l.level}</TableCell>
                    <TableCell className="text-xs">{new Date(l.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={status === "Active" ? "default" : status === "Used" ? "secondary" : "destructive"}>{status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {status === "Active" && (
                        <Button size="sm" variant="outline" className="mr-2" onClick={() => copyLink(l.token)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) delMut.mutate(l.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
