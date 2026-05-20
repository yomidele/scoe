import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCallerScope(userId: string) {
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const isSuper = roles?.some((r) => r.role === "super_admin");
  if (isSuper) return { isSuper: true as const, facultyId: null as string | null };
  const { data: fa } = await supabaseAdmin.from("faculty_admins").select("faculty_id").eq("user_id", userId).maybeSingle();
  if (!fa) throw new Error("Forbidden");
  return { isSuper: false as const, facultyId: fa.faculty_id };
}

export const createRegistrationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        faculty_id: z.string().uuid(),
        department_id: z.string().uuid(),
        level: z.number().int().min(100).max(400),
        expires_in_days: z.number().int().min(1).max(60).default(14),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const scope = await getCallerScope(context.userId);
    if (!scope.isSuper && scope.facultyId !== data.faculty_id) {
      throw new Error("You can only create links for your own faculty");
    }
    const expiresAt = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString();
    const { data: link, error } = await supabaseAdmin
      .from("registration_links")
      .insert({
        faculty_id: data.faculty_id,
        department_id: data.department_id,
        level: data.level,
        expires_at: expiresAt,
        created_by: context.userId,
      })
      .select("id, token, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return link;
  });

export const listRegistrationLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await getCallerScope(context.userId);
    let q = supabaseAdmin
      .from("registration_links")
      .select("id, token, level, expires_at, used_at, created_at, faculty_id, department_id")
      .order("created_at", { ascending: false });
    if (!scope.isSuper && scope.facultyId) q = q.eq("faculty_id", scope.facultyId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const facultyIds = [...new Set(rows.map((r) => r.faculty_id))];
    const deptIds = [...new Set(rows.map((r) => r.department_id))];
    const [{ data: facs }, { data: deps }] = await Promise.all([
      facultyIds.length ? supabaseAdmin.from("faculties").select("id, name").in("id", facultyIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      deptIds.length ? supabaseAdmin.from("departments").select("id, name").in("id", deptIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const facMap = new Map((facs ?? []).map((f) => [f.id, f.name]));
    const depMap = new Map((deps ?? []).map((d) => [d.id, d.name]));
    return rows.map((r) => ({
      ...r,
      faculties: { name: facMap.get(r.faculty_id) ?? null },
      departments: { name: depMap.get(r.department_id) ?? null },
    }));
  });

export const deleteRegistrationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const scope = await getCallerScope(context.userId);
    let q = supabaseAdmin.from("registration_links").delete().eq("id", data.id);
    if (!scope.isSuper && scope.facultyId) q = q.eq("faculty_id", scope.facultyId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
