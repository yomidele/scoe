import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { TSUHeader } from "./TSUHeader";
import { LayoutDashboard, CalendarDays, BookOpen, Users, ClipboardEdit, FileSpreadsheet, FileText, LogOut, Building2, Shield, BarChart3, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Academic Sessions", icon: CalendarDays },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/students", label: "Students", icon: Users },
  { to: "/result-entry", label: "Result Entry", icon: ClipboardEdit },
  { to: "/results", label: "View / Export Results", icon: FileSpreadsheet },
  { to: "/transcripts", label: "Transcripts", icon: FileText },
] as const;

const SUPER_ADMIN_NAV = [
  { to: "/admin/faculties", label: "Faculties", icon: Building2 },
  { to: "/admin/faculty-admins", label: "Faculty Admins", icon: Shield },
  { to: "/admin/registration-links", label: "Registration Links", icon: LinkIcon },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin } = useRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader subtitle="Admin Console — Demo Environment" />
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
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            })}
            {isSuperAdmin && (
              <>
                <div className="hidden md:block md:px-2 md:pt-3 md:pb-1 md:text-[10px] md:font-semibold md:uppercase md:tracking-wider md:text-muted-foreground">
                  Super Admin
                </div>
                {SUPER_ADMIN_NAV.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="whitespace-nowrap">{label}</span>
                    </Link>
                  );
                })}
              </>
            )}
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
        © {new Date().getFullYear()} Shallom College of Education, Pambula Michika — Demo build
      </footer>
    </div>
  );
}
