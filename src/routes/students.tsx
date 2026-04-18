import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — TSU" }] }),
  component: () => <ProtectedAdmin><StudentsPage /></ProtectedAdmin>,
});

const LEVELS = [100, 200, 300, 400] as const;

function StudentsPage() {
  const qc = useQueryClient();
  const [matric, setMatric] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("100");
  const [filterLevel, setFilterLevel] = useState("all");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("matric_number");
      if (error) throw error;
      return data;
    },
  });

  const filtered = students.filter((s) => filterLevel === "all" || s.level === Number(filterLevel));

  const addMut = useMutation({
    mutationFn: async () => {
      if (!matric.trim() || !name.trim()) throw new Error("Fill all fields");
      const { error } = await supabase.from("students").insert({
        matric_number: matric.trim().toUpperCase(),
        full_name: name.trim(),
        level: Number(level),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student added");
      setMatric(""); setName("");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["count", "students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Student removed"); qc.invalidateQueries({ queryKey: ["students"] }); qc.invalidateQueries({ queryKey: ["count", "students"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Student Management</h2>
        <p className="text-sm text-muted-foreground">Register students by matric number, name, and level.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Add a student</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); addMut.mutate(); }} className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Matric No</Label>
              <Input placeholder="TSU/FED/EC/24/1001" value={matric} onChange={(e) => setMatric(e.target.value)} required />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Full name</Label>
              <Input placeholder="Tommy Ruth" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Add student"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tsu-shadow">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">All students</CardTitle>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((l) => <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matric No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Level</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No students match.</TableCell></TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.matric_number}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="text-center">{s.level}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${s.full_name}? Related results will be removed.`)) delMut.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
