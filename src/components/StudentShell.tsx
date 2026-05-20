import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { TSUHeader } from "./TSUHeader";
import { LayoutDashboard, User, GraduationCap, AlertTriangle, BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/use-auth";

const NAV = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/profile", label: "Profile", icon: User },
  { to: "/student/results", label: "My Results", icon: GraduationCap },
  { to: "/student/carryovers", label: "Carryovers", icon: AlertTriangle },
  { to: "/student/courses", label: "Course Registration", icon: BookOpen },
] as const;

export function StudentShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuthSession();

  const { data: student } = useQuery({
    queryKey: ["student-self", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("full_name, matric_number, passport_url, level")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      return data;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/student/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader subtitle={student ? `Student Portal — ${student.full_name}` : "Student Portal"} />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-2 py-4 md:flex-row md:px-6">
        <aside className="md:w-60 md:shrink-0">
          <nav className="tsu-shadow flex flex-col gap-1 rounded-md border border-border bg-card p-2">
            {student && (
              <div className="mb-2 flex items-center gap-2 rounded-md bg-secondary p-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={student.passport_url ?? undefined} />
                  <AvatarFallback>{student.full_name?.[0] ?? "S"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{student.full_name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{student.matric_number}</p>
                </div>
              </div>
            )}
            <div className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="md:mt-auto md:pt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Shallom College of Education, Pambula Michika
      </footer>
    </div>
  );
}
