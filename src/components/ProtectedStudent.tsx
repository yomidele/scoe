import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { StudentShell } from "./StudentShell";
import { Loader2 } from "lucide-react";

export function ProtectedStudent({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { isStudent, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session) navigate({ to: "/student/login" });
    else if (!isStudent) navigate({ to: "/" });
  }, [loading, roleLoading, session, isStudent, navigate]);

  if (loading || roleLoading || !session || !isStudent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <StudentShell>{children}</StudentShell>;
}
