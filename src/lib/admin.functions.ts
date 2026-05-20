import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

export const createFacultyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        full_name: z.string().min(1).max(255),
        phone: z.string().max(40).optional().nullable(),
        faculty_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      await assertSuperAdmin(context.userId);

      const { data: created, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (signUpError || !created?.user) {
        throw new Error(signUpError?.message ?? "Failed to create user");
      }

      const userId = created.user.id;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "faculty_admin" });
      if (roleError) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Role assignment failed: ${roleError.message}`);
      }

      const { error: adminError } = await supabaseAdmin.from("faculty_admins").insert({
        user_id: userId,
        faculty_id: data.faculty_id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
      });
      if (adminError) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Faculty admin insert failed: ${adminError.message}`);
      }

      return { user_id: userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("createFacultyAdmin failed:", msg);
      throw new Error(msg);
    }
  });

export const deleteFacultyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await supabaseAdmin.from("faculty_admins").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "faculty_admin");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    return { ok: true };
  });
