import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/sessions")({
  head: () => ({ meta: [{ title: "Academic Sessions — SCOE" }] }),
  component: () => <ProtectedAdmin><SessionsPage /></ProtectedAdmin>,
});

function SessionsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("*").order("name", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("academic_sessions").insert({ name: n });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session created"); setName(""); qc.invalidateQueries({ queryKey: ["sessions"] }); qc.invalidateQueries({ queryKey: ["count","academic_sessions"]}); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session removed"); qc.invalidateQueries({ queryKey: ["sessions"] }); qc.invalidateQueries({ queryKey: ["count","academic_sessions"]}); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Academic Sessions</h2>
        <p className="text-sm text-muted-foreground">Define the academic sessions used across the portal.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Add a session</CardTitle>
          <CardDescription>Format: <code>YYYY/YYYY</code> (e.g. 2024/2025).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; addMut.mutate(name.trim()); }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="sname">Session name</Label>
              <Input id="sname" placeholder="2024/2025" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Add session"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Existing sessions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && sessions.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No sessions yet.</TableCell></TableRow>
                )}
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete session ${s.name}? Related results will be removed.`)) delMut.mutate(s.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
