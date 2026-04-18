import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_EMAIL = "admin@tsu.demo";
const DEMO_PASSWORD = "demo1234";

export const ensureDemoAdmin = createServerFn({ method: "POST" }).handler(async () => {
  try {
    // List users and look for demo admin
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      console.error("listUsers error:", listErr);
      return { ok: false, error: listErr.message };
    }
    const exists = list.users.some((u) => u.email === DEMO_EMAIL);
    if (exists) return { ok: true, created: false };

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "admin", display_name: "Demo Admin" },
    });
    if (createErr) {
      console.error("createUser error:", createErr);
      return { ok: false, error: createErr.message };
    }
    return { ok: true, created: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ensureDemoAdmin failed:", msg);
    return { ok: false, error: msg };
  }
});
