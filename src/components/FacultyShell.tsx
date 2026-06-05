import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { TSUHeader } from "./TSUHeader";
import { LayoutDashboard, BookOpen, Users, ClipboardEdit, FileSpreadsheet, FileText, LogOut, AlertTriangle, LinkIcon, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/use-auth";

const NAV = [
  { to: "/faculty/dashboard", label: "Faculty Dashboard", icon: LayoutDashboard },
  { to: "/faculty/courses", label: "Courses", icon: BookOpen },
  { to: "/faculty/students", label: "Students", icon: Users },
  { to: "/faculty/dept-admins", label: "Department Admins", icon: UserCog },
  { to: "/faculty/result-entry", label: "Result Entry", icon: ClipboardEdit },
  { to: "/faculty/results", label: "View / Export Results", icon: FileSpreadsheet },
  { to: "/faculty/transcripts", label: "Transcripts", icon: FileText },
  { to: "/faculty/carryovers", label: "Carryovers", icon: AlertTriangle },
  { to: "/faculty/registration-links", label: "Registration Links", icon: LinkIcon },
] as const;

export function FacultyShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuthSession();

  const { data: facultyInfo } = useQuery({
    queryKey: ["faculty-admin-self", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("faculty_admins")
        .select("full_name, faculties:faculty_id(name, code)")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      return data;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/faculty/login" });
  };

  const facultyName = (facultyInfo?.faculties as { name?: string } | null)?.name;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader subtitle={facultyName ? `Faculty Admin Console — ${facultyName}` : "Faculty Admin Console"} />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-2 py-4 md:flex-row md:px-6">
        <aside className="md:w-60 md:shrink-0">
          <nav className="tsu-shadow flex flex-row gap-1 overflow-x-auto rounded-md border border-border bg-card p-2 md:flex-col md:overflow-visible">
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
        © {new Date().getFullYear()} Shallom College of Education, Pambula Michika — Faculty Portal
      </footer>
    </div>
  );
}
