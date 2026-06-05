import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedDeptAdmin } from "@/components/ProtectedDeptAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { Users, ClipboardCheck, LinkIcon, BookOpen } from "lucide-react";

export const Route = createFileRoute("/dept-admin/dashboard")({
  head: () => ({ meta: [{ title: "Department Dashboard — SCOE" }] }),
  component: () => <ProtectedDeptAdmin><Page /></ProtectedDeptAdmin>,
});

function Page() {
  const { session } = useAuthSession();
  const selfQ = useQuery({
    queryKey: ["dept-admin-self", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from("department_admins")
        .select("full_name, departments:department_id(name, code), faculties:faculty_id(name)")
        .eq("user_id", session!.user.id).maybeSingle();
      return data;
    },
  });
  const lecturersCount = useQuery({
    queryKey: ["dept-lecturers-count"],
    queryFn: async () => (await supabase.from("lecturers").select("*", { count: "exact", head: true })).count ?? 0,
  });
  const pending = useQuery({
    queryKey: ["dept-pending-count"],
    queryFn: async () => (await supabase.from("results").select("*", { count: "exact", head: true }).eq("status", "submitted")).count ?? 0,
  });
  const courses = useQuery({
    queryKey: ["dept-courses-count"],
    queryFn: async () => (await supabase.from("courses").select("*", { count: "exact", head: true })).count ?? 0,
  });

  const dept = (selfQ.data?.departments as { name?: string } | null)?.name;
  const stats = [
    { label: "Lecturers", value: lecturersCount.data, icon: Users, to: "/dept-admin/lecturers" as const },
    { label: "Courses", value: courses.data, icon: BookOpen, to: "/dept-admin/assignments" as const },
    { label: "Pending Approvals", value: pending.data, icon: ClipboardCheck, to: "/dept-admin/approvals" as const },
    { label: "Assignments", value: "→", icon: LinkIcon, to: "/dept-admin/assignments" as const },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">{dept ? `${dept} Department` : "Department"}</h2>
        <p className="text-sm text-muted-foreground">Manage lecturers, assign courses, approve and publish results.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <Card className="tsu-shadow transition-colors hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{value ?? "—"}</span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
