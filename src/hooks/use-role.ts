import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./use-auth";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"] extends { app_role: infer R } ? R : "super_admin" | "faculty_admin" | "student";

export function useRole() {
  const { session, loading: sessionLoading } = useAuthSession();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      setRoles((data ?? []).map((r) => r.role as AppRole));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  return {
    roles,
    loading: sessionLoading || loading,
    isSuperAdmin: roles.includes("super_admin" as AppRole),
    isFacultyAdmin: roles.includes("faculty_admin" as AppRole),
    isStudent: roles.includes("student" as AppRole),
  };
}
