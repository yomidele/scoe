import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLecturer } from "@/components/ProtectedLecturer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/lecturer/dashboard")({
  head: () => ({ meta: [{ title: "Lecturer Dashboard — SCOE" }] }),
  component: () => <ProtectedLecturer><Page /></ProtectedLecturer>,
});

function Page() {
  const { session } = useAuthSession();
  const lecturer = useQuery({
    queryKey: ["lecturer-self", session?.user.id], enabled: !!session,
    queryFn: async () => (await supabase.from("lecturers").select("id, full_name").eq("user_id", session!.user.id).maybeSingle()).data,
  });
  const assignments = useQuery({
    queryKey: ["lecturer-assignments", lecturer.data?.id], enabled: !!lecturer.data,
    queryFn: async () => {
      const { data } = await supabase.from("course_assignments")
        .select("id, semester, course_id, session_id, courses(code, title, level, unit), academic_sessions(name)")
        .eq("lecturer_id", lecturer.data!.id);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Welcome{lecturer.data ? `, ${lecturer.data.full_name}` : ""}</h2>
        <p className="text-sm text-muted-foreground">Courses assigned to you. Click one to enter scores.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(assignments.data ?? []).map((a: any) => (
          <Link key={a.id} to="/lecturer/entry" search={{ assignment_id: a.id }}>
            <Card className="tsu-shadow transition-colors hover:border-primary">
              <CardHeader><CardTitle className="text-base">{a.courses?.code} — {a.courses?.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Level {a.courses?.level} · {a.semester} Semester · {a.courses?.unit} units · {a.academic_sessions?.name}
              </CardContent>
            </Card>
          </Link>
        ))}
        {(assignments.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No courses assigned yet. Contact your Department Admin.</p>}
      </div>
    </div>
  );
}
