import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedFaculty } from "@/components/ProtectedFaculty";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Users, ClipboardList, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/faculty/dashboard")({
  head: () => ({ meta: [{ title: "Faculty Dashboard — SCOE" }] }),
  component: () => (
    <ProtectedFaculty>
      <FacultyDashboard />
    </ProtectedFaculty>
  ),
});

function useScopedCount(table: "courses" | "students" | "results") {
  return useQuery({
    queryKey: ["faculty-count", table],
    queryFn: async () => {
      // RLS automatically scopes to the faculty admin's faculty
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function FacultyDashboard() {
  const courses = useScopedCount("courses");
  const students = useScopedCount("students");
  const results = useScopedCount("results");

  const stats = [
    { label: "Courses", value: courses.data, icon: BookOpen, to: "/faculty/courses" as const },
    { label: "Students", value: students.data, icon: Users, to: "/faculty/students" as const },
    { label: "Results Recorded", value: results.data, icon: ClipboardList, to: "/faculty/results" as const },
    { label: "Result Entry", value: "→", icon: FileSpreadsheet, to: "/faculty/result-entry" as const },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground">Faculty Overview</h2>
        <p className="text-sm text-muted-foreground">All figures are scoped to your faculty.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link to={to} key={label}>
            <Card className="tsu-shadow transition-colors hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{value ?? "—"}</span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Quick actions</CardTitle>
          <CardDescription>Run your faculty's academic workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>Add <Link to="/faculty/courses" className="font-medium text-primary underline">Courses</Link> for your faculty's programmes.</li>
            <li>Register <Link to="/faculty/students" className="font-medium text-primary underline">Students</Link> by matric number.</li>
            <li>Enter scores in <Link to="/faculty/result-entry" className="font-medium text-primary underline">Result Entry</Link>.</li>
            <li>Export from <Link to="/faculty/results" className="font-medium text-primary underline">View / Export Results</Link>.</li>
            <li>Print <Link to="/faculty/transcripts" className="font-medium text-primary underline">Transcripts</Link> for graduating students.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
