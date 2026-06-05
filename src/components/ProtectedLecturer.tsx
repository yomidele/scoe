import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { LecturerShell } from "./LecturerShell";
import { Loader2 } from "lucide-react";

export function ProtectedLecturer({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const { loading: roleLoading, roles } = useRole();
  const navigate = useNavigate();
  const allowed = roles.includes("lecturer" as never) || roles.includes("super_admin" as never);

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!session || !allowed) navigate({ to: "/lecturer/login" });
  }, [loading, roleLoading, session, allowed, navigate]);

  if (loading || roleLoading || !session) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  return <LecturerShell>{children}</LecturerShell>;
}
