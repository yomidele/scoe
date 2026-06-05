import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { TSUHeader } from "./TSUHeader";
import { LayoutDashboard, ClipboardEdit, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAV = [
  { to: "/lecturer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lecturer/entry", label: "Score Entry", icon: ClipboardEdit },
] as const;

export function LecturerShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/lecturer/login" });
  };
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader subtitle="Lecturer Console" />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-2 py-4 md:flex-row md:px-6">
        <aside className="md:w-60 md:shrink-0">
          <nav className="tsu-shadow flex flex-row gap-1 overflow-x-auto rounded-md border border-border bg-card p-2 md:flex-col md:overflow-visible">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            })}
            <div className="md:mt-auto md:pt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
