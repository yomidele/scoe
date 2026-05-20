import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { FacultyShell } from "./FacultyShell";
import { Loader2 } from "lucide-react";

export function ProtectedFaculty({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { loading: roleLoading, isFacultyAdmin, isSuperAdmin } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session) {
      navigate({ to: "/faculty/login" });
      return;
    }
    // Super admins can also access for oversight; otherwise must be faculty admin
    if (!isFacultyAdmin && !isSuperAdmin) {
      navigate({ to: "/faculty/login" });
    }
  }, [loading, roleLoading, session, isFacultyAdmin, isSuperAdmin, navigate]);

  if (loading || roleLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <FacultyShell>{children}</FacultyShell>;
}
