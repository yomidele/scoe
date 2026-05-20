import { createFileRoute } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/student/profile")({
  head: () => ({ meta: [{ title: "Profile — SCOE" }] }),
  component: () => <ProtectedStudent><ProfilePage /></ProtectedStudent>,
});

function ProfilePage() {
  const { session } = useAuthSession();
  const { data: s } = useQuery({
    queryKey: ["student-profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("students").select("*, faculties:faculty_id(name), departments:department_id(name)").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  if (!s) return <p className="p-6 text-muted-foreground">Loading…</p>;

  const rows: Array<[string, string | number | null | undefined]> = [
    ["Matric Number", s.matric_number],
    ["Full Name", s.full_name],
    ["Email", s.email],
    ["Phone", s.phone],
    ["Faculty", (s.faculties as { name?: string } | null)?.name],
    ["Department", (s.departments as { name?: string } | null)?.name],
    ["Level", s.level],
    ["Gender", s.gender],
    ["Date of Birth", s.date_of_birth],
    ["State of Origin", s.state_of_origin],
    ["Address", s.address],
    ["Guardian Name", s.guardian_name],
    ["Guardian Phone", s.guardian_phone],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">My Profile</h2>
        <p className="text-sm text-muted-foreground">Contact your Faculty Admin to update profile details.</p>
      </div>
      <Card className="tsu-shadow">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-20 w-20 border">
            <AvatarImage src={s.passport_url ?? undefined} />
            <AvatarFallback>{s.full_name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="font-serif text-xl">{s.full_name}</CardTitle>
            <p className="font-mono text-sm text-muted-foreground">{s.matric_number}</p>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-md border border-border p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
