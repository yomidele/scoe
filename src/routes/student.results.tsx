import { createFileRoute } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { computeGrade, effectiveTotal, classOfDegree } from "@/lib/grading";
import { useMemo } from "react";

export const Route = createFileRoute("/student/results")({
  head: () => ({ meta: [{ title: "My Results — SCOE" }] }),
  component: () => <ProtectedStudent><ResultsPage /></ProtectedStudent>,
});

function ResultsPage() {
  const { session } = useAuthSession();
  const { data: student } = useQuery({
    queryKey: ["s-id", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("students").select("id, full_name, matric_number").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["my-results", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("results")
        .select("id, ca_score, exam_score, total_score, level, semester, courses(code, title, unit), academic_sessions(name)")
        .eq("student_id", student!.id);
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof results>();
    for (const r of results) {
      const key = `${(r.academic_sessions as { name?: string } | null)?.name ?? "—"} • ${r.level}L • ${r.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [results]);

  let totalPts = 0, totalUnits = 0;
  for (const r of results) {
    const u = (r.courses as { unit?: number } | null)?.unit ?? 0;
    const { point } = computeGrade(effectiveTotal(r));
    totalPts += point * u; totalUnits += u;
  }
  const cgpa = totalUnits ? totalPts / totalUnits : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">My Results</h2>
        <p className="text-sm text-muted-foreground">
          CGPA: <span className="font-bold text-foreground">{totalUnits ? cgpa.toFixed(2) : "—"}</span>
          {totalUnits > 0 && <> • {classOfDegree(cgpa)}</>}
        </p>
      </div>

      {grouped.length === 0 && (
        <Card className="tsu-shadow"><CardContent className="py-10 text-center text-muted-foreground">No results have been published yet.</CardContent></Card>
      )}

      {grouped.map(([label, rows]) => {
        let pts = 0, un = 0;
        for (const r of rows) {
          const u = (r.courses as { unit?: number } | null)?.unit ?? 0;
          const { point } = computeGrade(effectiveTotal(r));
          pts += point * u; un += u;
        }
        const gpa = un ? pts / un : 0;
        return (
          <Card key={label} className="tsu-shadow">
            <CardHeader><CardTitle className="text-base">{label} — GPA {gpa.toFixed(2)}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const total = effectiveTotal(r);
                    const { grade } = computeGrade(total);
                    const c = r.courses as { code?: string; title?: string; unit?: number } | null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-medium">{c?.code}</TableCell>
                        <TableCell>{c?.title}</TableCell>
                        <TableCell className="text-center">{c?.unit}</TableCell>
                        <TableCell className="text-center">{total}</TableCell>
                        <TableCell className="text-center font-bold">{grade}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
