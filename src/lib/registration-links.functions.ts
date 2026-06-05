import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getCallerScope(userId: string) {
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const isSuper = roles?.some((r) => r.role === "super_admin");
  if (isSuper) return { isSuper: true as const };
  const { data: fa } = await supabaseAdmin.from("faculty_admins").select("faculty_id").eq("user_id", userId).maybeSingle();
  if (!fa) throw new Error("Forbidden");
  return { isSuper: false as const };
}

export const createRegistrationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        expires_in_days: z.number().int().min(1).max(365).default(30),
        max_uses: z.number().int().min(1).max(100000).optional().nullable(),
        label: z.string().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await getCallerScope(context.userId);
    const expiresAt = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString();
    const { data: link, error } = await supabaseAdmin
      .from("registration_links")
      .insert({
        expires_at: expiresAt,
        max_uses: data.max_uses ?? null,
        label: data.label ?? null,
        created_by: context.userId,
      })
      .select("id, token, expires_at, used_at, created_at, use_count, max_uses, label")
      .single();
    if (error) throw new Error(error.message);
    return link;
  });

export const listRegistrationLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await getCallerScope(context.userId);
    const { data, error } = await supabaseAdmin
      .from("registration_links")
      .select("id, token, expires_at, used_at, created_at, use_count, max_uses, label")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteRegistrationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await getCallerScope(context.userId);
    const { error } = await supabaseAdmin.from("registration_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
