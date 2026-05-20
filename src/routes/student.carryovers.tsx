import { createFileRoute } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/student/carryovers")({
  head: () => ({ meta: [{ title: "Carryovers — SCOE" }] }),
  component: () => <ProtectedStudent><CarryoversPage /></ProtectedStudent>,
});

function CarryoversPage() {
  const { session } = useAuthSession();
  const { data: student } = useQuery({
    queryKey: ["sid-co", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("students").select("id").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const { data: carryovers = [] } = useQuery({
    queryKey: ["my-co", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("carryovers")
        .select("*, courses(code, title, unit), failed_session:academic_sessions!failed_session_id(name)")
        .eq("student_id", student!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const pending = carryovers.filter((c) => c.status === "pending");
  const cleared = carryovers.filter((c) => c.status === "cleared");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">My Carryovers</h2>
        <p className="text-sm text-muted-foreground">Failed courses are tracked automatically. Re-register and pass them to clear.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Pending ({pending.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No pending carryovers. Keep it up!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Unit</TableHead>
                  <TableHead>Failed In</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((c) => {
                  const course = c.courses as { code?: string; title?: string; unit?: number } | null;
                  const sess = (c.failed_session as { name?: string } | null)?.name;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{course?.code}</TableCell>
                      <TableCell>{course?.title}</TableCell>
                      <TableCell className="text-center">{course?.unit}</TableCell>
                      <TableCell>{sess} • {c.failed_level}L • {c.failed_semester}</TableCell>
                      <TableCell><Badge variant="destructive">Pending</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {cleared.length > 0 && (
        <Card className="tsu-shadow">
          <CardHeader><CardTitle className="text-base">Cleared ({cleared.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleared.map((c) => {
                  const course = c.courses as { code?: string; title?: string } | null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{course?.code}</TableCell>
                      <TableCell>{course?.title}</TableCell>
                      <TableCell><Badge>Cleared</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
