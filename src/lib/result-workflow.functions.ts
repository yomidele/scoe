import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TransitionInput = z.object({
  result_ids: z.array(z.string().uuid()).min(1).max(2000),
  reason: z.string().max(500).optional(),
});

async function getCallerRoles(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

export const lecturerSubmitResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("lecturer")) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("results")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .in("id", data.result_ids)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertDeptAdminCanTouch(userId: string, resultIds: string[]) {
  const { data: scope } = await supabaseAdmin
    .from("department_admins").select("department_id").eq("user_id", userId).maybeSingle();
  if (!scope) throw new Error("Forbidden: not a department admin");
  const { data: rows } = await supabaseAdmin
    .from("results").select("id, student_id").in("id", resultIds);
  const studentIds = Array.from(new Set((rows ?? []).map((r) => r.student_id)));
  if (studentIds.length === 0) throw new Error("No matching results");
  const { data: students } = await supabaseAdmin
    .from("students").select("id, department_id").in("id", studentIds);
  const bad = (students ?? []).find((s) => s.department_id !== scope.department_id);
  if (bad) throw new Error("Forbidden: results contain another department's students");
}

export const deptAdminApproveResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("department_admin")) throw new Error("Forbidden");
    await assertDeptAdminCanTouch(context.userId, data.result_ids);
    const { error } = await supabaseAdmin.from("results")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .in("id", data.result_ids).eq("status", "submitted");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deptAdminPublishResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("department_admin")) throw new Error("Forbidden");
    await assertDeptAdminCanTouch(context.userId, data.result_ids);
    const { error } = await supabaseAdmin.from("results")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", data.result_ids).in("status", ["approved", "submitted"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deptAdminReturnResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransitionInput.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context.userId);
    if (!roles.includes("department_admin")) throw new Error("Forbidden");
    await assertDeptAdminCanTouch(context.userId, data.result_ids);
    const { error } = await supabaseAdmin.from("results")
      .update({ status: "draft", submitted_at: null, approved_at: null, returned_reason: data.reason ?? null })
      .in("id", data.result_ids).in("status", ["submitted", "approved"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
