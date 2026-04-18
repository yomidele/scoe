import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, BookOpen, Users, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SCOE Result Portal" }] }),
  component: () => <ProtectedAdmin><DashboardPage /></ProtectedAdmin>,
});

function useCount(table: "academic_sessions" | "courses" | "students" | "results") {
  return useQuery({
    queryKey: ["count", table],
    queryFn: async () => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function DashboardPage() {
  const sessions = useCount("academic_sessions");
  const courses = useCount("courses");
  const students = useCount("students");
  const results = useCount("results");

  const stats = [
    { label: "Academic Sessions", value: sessions.data, icon: CalendarDays, to: "/sessions" },
    { label: "Courses", value: courses.data, icon: BookOpen, to: "/courses" },
    { label: "Students", value: students.data, icon: Users, to: "/students" },
    { label: "Results Recorded", value: results.data, icon: ClipboardList, to: "/results" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground">Welcome, Administrator</h2>
        <p className="text-sm text-muted-foreground">Overview of the result management system.</p>
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
          <CardTitle className="font-serif text-lg">Getting started</CardTitle>
          <CardDescription>Follow these steps to demo the full result lifecycle.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>Create an <Link to="/sessions" className="font-medium text-primary underline">Academic Session</Link> (e.g. 2024/2025).</li>
            <li>Add <Link to="/courses" className="font-medium text-primary underline">Courses</Link> for each level and semester.</li>
            <li>Register <Link to="/students" className="font-medium text-primary underline">Students</Link> with matric numbers.</li>
            <li>Use <Link to="/result-entry" className="font-medium text-primary underline">Result Entry</Link> to record CA &amp; Exam scores.</li>
            <li>View, print, or export the result sheet from <Link to="/results" className="font-medium text-primary underline">View / Export Results</Link>.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
