import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, Users, BookOpen, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "University Analytics — Super Admin" }] }),
  component: () => (
    <ProtectedAdmin>
      <Page />
    </ProtectedAdmin>
  ),
});

function Page() {
  const { isSuperAdmin, loading } = useRole();
  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin text-primary" />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;
  return <Analytics />;
}

function useCount(table: "faculties" | "departments" | "students" | "courses" | "results" | "faculty_admins") {
  return useQuery({
    queryKey: ["analytics-count", table],
    queryFn: async () => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Analytics() {
  const faculties = useCount("faculties");
  const departments = useCount("departments");
  const students = useCount("students");
  const courses = useCount("courses");
  const results = useCount("results");
  const admins = useCount("faculty_admins");

  const byFaculty = useQuery({
    queryKey: ["analytics-by-faculty"],
    queryFn: async () => {
      const [{ data: facs }, { data: stu }, { data: crs }] = await Promise.all([
        supabase.from("faculties").select("id, name, code"),
        supabase.from("students").select("faculty_id"),
        supabase.from("courses").select("faculty_id"),
      ]);
      return (facs ?? []).map((f) => ({
        ...f,
        students: (stu ?? []).filter((s) => s.faculty_id === f.id).length,
        courses: (crs ?? []).filter((c) => c.faculty_id === f.id).length,
      }));
    },
  });

  const stats = [
    { label: "Faculties", value: faculties.data, icon: Building2 },
    { label: "Departments", value: departments.data, icon: Building2 },
    { label: "Faculty Admins", value: admins.data, icon: Users },
    { label: "Students", value: students.data, icon: Users },
    { label: "Courses", value: courses.data, icon: BookOpen },
    { label: "Results", value: results.data, icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">University Analytics</h2>
        <p className="text-sm text-muted-foreground">Cross-faculty overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{value ?? "—"}</span>
              </div>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Breakdown by faculty</CardTitle></CardHeader>
        <CardContent>
          {byFaculty.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Faculty</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3 text-right">Students</th>
                    <th className="py-2 pr-3 text-right">Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {(byFaculty.data ?? []).map((f) => (
                    <tr key={f.id} className="border-b">
                      <td className="py-2 pr-3 font-medium">{f.name}</td>
                      <td className="py-2 pr-3">{f.code}</td>
                      <td className="py-2 pr-3 text-right">{f.students}</td>
                      <td className="py-2 pr-3 text-right">{f.courses}</td>
                    </tr>
                  ))}
                  {(byFaculty.data ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No faculties yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
