import { createFileRoute } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/faculty/carryovers")({
  head: () => ({ meta: [{ title: "Faculty Carryovers — SCOE" }] }),
  component: () => <ProtectedFaculty><FacultyCarryoversPage /></ProtectedFaculty>,
});

function FacultyCarryoversPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["faculty-carryovers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("carryovers")
        .select("*, students(matric_number, full_name), courses(code, title, unit)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const pending = rows.filter((r) => r.status === "pending");
  const cleared = rows.filter((r) => r.status === "cleared");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Carryovers</h2>
        <p className="text-sm text-muted-foreground">Auto-tracked when results are entered.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="tsu-shadow"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Pending</p><p className="text-2xl font-bold">{pending.length}</p></CardContent></Card>
        <Card className="tsu-shadow"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Cleared</p><p className="text-2xl font-bold">{cleared.length}</p></CardContent></Card>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">All carryover records</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matric</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Failed Level/Sem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No carryovers yet.</TableCell></TableRow>}
              {rows.map((r) => {
                const s = r.students as { matric_number?: string; full_name?: string } | null;
                const c = r.courses as { code?: string; title?: string } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{s?.matric_number}</TableCell>
                    <TableCell>{s?.full_name}</TableCell>
                    <TableCell><span className="font-mono">{c?.code}</span> {c?.title}</TableCell>
                    <TableCell>{r.failed_level}L • {r.failed_semester}</TableCell>
                    <TableCell><Badge variant={r.status === "pending" ? "destructive" : "default"}>{r.status}</Badge></TableCell>
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
