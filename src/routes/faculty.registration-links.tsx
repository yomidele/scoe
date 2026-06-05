import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { createRegistrationLink, listRegistrationLinks, deleteRegistrationLink } from "@/lib/registration-links.functions";

export const Route = createFileRoute("/faculty/registration-links")({
  head: () => ({ meta: [{ title: "Registration Links — SCOE" }] }),
  component: () => <ProtectedFaculty><LinksPage /></ProtectedFaculty>,
});

function LinksPage() {
  const qc = useQueryClient();
  const create = useServerFn(createRegistrationLink);
  const list = useServerFn(listRegistrationLinks);
  const del = useServerFn(deleteRegistrationLink);

  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [maxUses, setMaxUses] = useState("");

  const { data: linksRaw } = useQuery({ queryKey: ["reg-links"], queryFn: () => list() });
  const links = Array.isArray(linksRaw) ? linksRaw : [];

  const createMut = useMutation({
    mutationFn: async () => create({
      data: {
        expires_in_days: Number(days),
        max_uses: maxUses ? Number(maxUses) : null,
        label: label || null,
      },
    }),
    onSuccess: (newLink) => {
      toast.success("Link created");
      qc.setQueryData(["reg-links"], (old: unknown) => [newLink, ...(Array.isArray(old) ? old : [])]);
      qc.invalidateQueries({ queryKey: ["reg-links"] });
      setLabel("");
      setMaxUses("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Link deleted"); qc.invalidateQueries({ queryKey: ["reg-links"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/student/register?token=${token}`);
    toast.success("Registration link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Registration Links</h2>
        <p className="text-sm text-muted-foreground">General-purpose links. Students choose their faculty, department, and level on the registration form.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Generate a link</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 2026 Intake" />
            </div>
            <div className="space-y-1.5">
              <Label>Expires (days)</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[7,14,30,60,90,180,365].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max uses</Label>
              <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
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
                <TableHead>Label</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-center">Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No links generated yet.</TableCell></TableRow>}
              {links.map((l) => {
                const expired = new Date(l.expires_at) < new Date();
                const exhausted = l.max_uses !== null && l.use_count >= l.max_uses;
                const status = expired ? "Expired" : exhausted ? "Used up" : "Active";
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.label ?? "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(l.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-center text-xs">{l.use_count}{l.max_uses ? `/${l.max_uses}` : ""}</TableCell>
                    <TableCell>
                      <Badge variant={status === "Active" ? "default" : status === "Used up" ? "secondary" : "destructive"}>{status}</Badge>
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
