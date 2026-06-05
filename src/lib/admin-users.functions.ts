import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCallerRoles(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

async function getFacultyAdminFacultyId(userId: string) {
  const { data } = await supabaseAdmin.from("faculty_admins").select("faculty_id").eq("user_id", userId).maybeSingle();
  return data?.faculty_id as string | undefined;
}

async function getDeptAdminScope(userId: string) {
  const { data } = await supabaseAdmin.from("department_admins").select("faculty_id, department_id").eq("user_id", userId).maybeSingle();
  return data as { faculty_id: string; department_id: string } | null;
}

// ===== Department Admins =====
export const createDepartmentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      full_name: z.string().min(1).max(255),
      phone: z.string().max(40).optional().nullable(),
      faculty_id: z.string().uuid(),
      department_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const roles = await getCallerRoles(context.userId);
      if (!roles.includes("super_admin")) {
        if (!roles.includes("faculty_admin")) throw new Error("Forbidden: only Super Admin or Faculty Admin");
        const callerFaculty = await getFacultyAdminFacultyId(context.userId);
        if (callerFaculty !== data.faculty_id) throw new Error("Forbidden: department is outside your faculty");
      }
      // Confirm dept belongs to faculty
      const { data: dept } = await supabaseAdmin.from("departments").select("faculty_id").eq("id", data.department_id).maybeSingle();
      if (!dept || dept.faculty_id !== data.faculty_id) throw new Error("Department does not belong to that faculty");

      const { data: created, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (signUpError || !created?.user) throw new Error(signUpError?.message ?? "Failed to create user");
      const userId = created.user.id;

      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "department_admin" });
      if (roleError) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Role assignment failed: ${roleError.message}`);
      }

      const { error: insErr } = await supabaseAdmin.from("department_admins").insert({
        user_id: userId, faculty_id: data.faculty_id, department_id: data.department_id,
        full_name: data.full_name, email: data.email, phone: data.phone ?? null,
      });
      if (insErr) {
        try { await supabaseAdmin.from("user_roles").delete().eq("user_id", userId); } catch {}
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Department admin insert failed: ${insErr.message}`);
      }
      return { user_id: userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("createDepartmentAdmin failed:", msg);
      throw new Error(msg);
    }
  });

export const deleteDepartmentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("super_admin") && !roles.includes("faculty_admin")) throw new Error("Forbidden");
    await supabaseAdmin.from("department_admins").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "department_admin");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id).catch(() => {});
    return { ok: true };
  });

// ===== Lecturers =====
export const createLecturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      full_name: z.string().min(1).max(255),
      phone: z.string().max(40).optional().nullable(),
      department_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const roles = await getCallerRoles(context.userId);
      const { data: dept } = await supabaseAdmin.from("departments").select("id, faculty_id").eq("id", data.department_id).maybeSingle();
      if (!dept) throw new Error("Department not found");

      let allowed = false;
      if (roles.includes("super_admin")) allowed = true;
      else if (roles.includes("faculty_admin")) {
        const fid = await getFacultyAdminFacultyId(context.userId);
        allowed = fid === dept.faculty_id;
      } else if (roles.includes("department_admin")) {
        const scope = await getDeptAdminScope(context.userId);
        allowed = !!scope && scope.department_id === data.department_id;
      }
      if (!allowed) throw new Error("Forbidden: not allowed to add lecturer to this department");

      const { data: created, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (signUpError || !created?.user) throw new Error(signUpError?.message ?? "Failed to create user");
      const userId = created.user.id;

      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "lecturer" });
      if (roleError) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Role assignment failed: ${roleError.message}`);
      }

      const { error: insErr } = await supabaseAdmin.from("lecturers").insert({
        user_id: userId, faculty_id: dept.faculty_id, department_id: dept.id,
        full_name: data.full_name, email: data.email, phone: data.phone ?? null,
      });
      if (insErr) {
        try { await supabaseAdmin.from("user_roles").delete().eq("user_id", userId); } catch {}
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Lecturer insert failed: ${insErr.message}`);
      }
      return { user_id: userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("createLecturer failed:", msg);
      throw new Error(msg);
    }
  });

export const deleteLecturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("super_admin") && !roles.includes("faculty_admin") && !roles.includes("department_admin")) {
      throw new Error("Forbidden");
    }
    await supabaseAdmin.from("lecturers").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "lecturer");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id).catch(() => {});
    return { ok: true };
  });
