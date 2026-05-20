import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { createRegistrationLink, listRegistrationLinks, deleteRegistrationLink } from "@/lib/registration-links.functions";

export const Route = createFileRoute("/faculty/registration-links")({
  head: () => ({ meta: [{ title: "Registration Links — SCOE" }] }),
  component: () => <ProtectedFaculty><LinksPage /></ProtectedFaculty>,
});

function LinksPage() {
  const qc = useQueryClient();
  const { session } = useAuthSession();
  const create = useServerFn(createRegistrationLink);
  const list = useServerFn(listRegistrationLinks);
  const del = useServerFn(deleteRegistrationLink);

  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("100");
  const [days, setDays] = useState("14");

  const { data: facultyInfo } = useQuery({
    queryKey: ["fa-self-links", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("faculty_admins").select("faculty_id").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["faculty-depts", facultyInfo?.faculty_id],
    enabled: !!facultyInfo?.faculty_id,
    queryFn: async () => (await supabase.from("departments").select("*").eq("faculty_id", facultyInfo!.faculty_id).order("name")).data ?? [],
  });

  const { data: links = [], refetch } = useQuery({
    queryKey: ["reg-links"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!facultyInfo?.faculty_id || !departmentId) throw new Error("Pick a department");
      return create({ data: { faculty_id: facultyInfo.faculty_id, department_id: departmentId, level: Number(level), expires_in_days: Number(days) } });
    },
    onSuccess: () => { toast.success("Link created"); qc.invalidateQueries({ queryKey: ["reg-links"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Link deleted"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/student/register?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Registration link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Student Registration Links</h2>
        <p className="text-sm text-muted-foreground">Generate one-time links to invite students to register.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Generate a link</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder={departments.length ? "Select" : "Ask Super Admin to add departments"} /></SelectTrigger>
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
              <Label>Expires in (days)</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,3,7,14,30,60].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Generating…" : "Generate Link"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">All links</CardTitle>
          <CardDescription>Click copy to send to a prospective student.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Level</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No links generated yet.</TableCell></TableRow>}
              {links.map((l) => {
                const expired = new Date(l.expires_at) < new Date();
                const status = l.used_at ? "Used" : expired ? "Expired" : "Active";
                return (
                  <TableRow key={l.id}>
                    <TableCell>{(l.departments as { name?: string } | null)?.name}</TableCell>
                    <TableCell className="text-center">{l.level}</TableCell>
                    <TableCell className="text-xs">{new Date(l.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={status === "Active" ? "default" : status === "Used" ? "secondary" : "destructive"}>{status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === "Active" && (
                        <Button size="sm" variant="outline" className="mr-2" onClick={() => copyLink(l.token)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}>
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
