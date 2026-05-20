import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { computeGrade, effectiveTotal, classOfDegree } from "@/lib/grading";
import { GraduationCap, AlertTriangle, BookOpen, FileText } from "lucide-react";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({ meta: [{ title: "Student Dashboard — SCOE" }] }),
  component: () => <ProtectedStudent><Dashboard /></ProtectedStudent>,
});

function Dashboard() {
  const { session } = useAuthSession();
  const uid = session?.user.id;

  const { data: student } = useQuery({
    queryKey: ["student-detail", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*, faculties:faculty_id(name), departments:department_id(name)").eq("user_id", uid!).maybeSingle();
      return data;
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["student-results", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("results")
        .select("id, ca_score, exam_score, total_score, courses(unit)")
        .eq("student_id", student!.id);
      return data ?? [];
    },
  });

  const { data: carryovers = [] } = useQuery({
    queryKey: ["student-carryovers", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase.from("carryovers").select("*").eq("student_id", student!.id).eq("status", "pending");
      return data ?? [];
    },
  });

  let pts = 0, units = 0;
  for (const r of results) {
    const u = (r.courses as { unit?: number } | null)?.unit ?? 0;
    const { point } = computeGrade(effectiveTotal(r));
    pts += point * u; units += u;
  }
  const cgpa = units ? pts / units : 0;

  const stats = [
    { label: "Current Level", value: student?.level ?? "—", icon: GraduationCap },
    { label: "CGPA", value: units ? cgpa.toFixed(2) : "—", icon: FileText },
    { label: "Carryovers", value: carryovers.length, icon: AlertTriangle },
    { label: "Courses Taken", value: results.length, icon: BookOpen },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Welcome, {student?.full_name?.split(" ")[0] ?? "Student"}</h2>
        <p className="text-sm text-muted-foreground">
          {(student?.faculties as { name?: string } | null)?.name} • {(student?.departments as { name?: string } | null)?.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="tsu-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{value}</span>
              </div>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Academic standing</CardTitle>
          <CardDescription>{units ? classOfDegree(cgpa) : "No results recorded yet."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><Link to="/student/results" className="font-medium text-primary underline">View detailed results →</Link></p>
          <p><Link to="/student/courses" className="font-medium text-primary underline">Register courses for the new semester →</Link></p>
          {carryovers.length > 0 && (
            <p className="text-destructive"><Link to="/student/carryovers" className="font-medium underline">Resolve {carryovers.length} pending carryover{carryovers.length > 1 ? "s" : ""} →</Link></p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
