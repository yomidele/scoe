import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public: validate a registration token and return faculty/department/level info.
export const validateRegistrationToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: link, error } = await supabaseAdmin
      .from("registration_links")
      .select("id, token, faculty_id, department_id, level, expires_at, used_at, faculties:faculty_id(name, code), departments:department_id(name, code)")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link) return { valid: false as const, reason: "Invalid token" };
    if (link.used_at) return { valid: false as const, reason: "This link has already been used" };
    if (new Date(link.expires_at) < new Date()) return { valid: false as const, reason: "This link has expired" };
    return {
      valid: true as const,
      link: {
        id: link.id,
        faculty_id: link.faculty_id,
        department_id: link.department_id,
        level: link.level,
        faculty_name: (link.faculties as { name?: string } | null)?.name ?? "",
        faculty_code: (link.faculties as { code?: string } | null)?.code ?? "",
        department_name: (link.departments as { name?: string } | null)?.name ?? "",
        department_code: (link.departments as { code?: string } | null)?.code ?? "DEPT",
      },
    };
  });

// Public: register a new student using a valid token. Creates auth user + student row + role + matric number.
export const registerStudentWithToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        full_name: z.string().min(2).max(120),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        phone: z.string().max(40).optional().nullable(),
        gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
        date_of_birth: z.string().optional().nullable(),
        address: z.string().max(500).optional().nullable(),
        state_of_origin: z.string().max(100).optional().nullable(),
        guardian_name: z.string().max(120).optional().nullable(),
        guardian_phone: z.string().max(40).optional().nullable(),
        passport_base64: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // 1. Validate token
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("registration_links")
      .select("*, departments:department_id(code)")
      .eq("token", data.token)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link || link.used_at || new Date(link.expires_at) < new Date()) {
      throw new Error("Registration link is invalid or expired");
    }

    // 2. Generate matric number: {DEPT_CODE}/{YY}/{4digit}
    const deptCode = (link.departments as { code?: string } | null)?.code?.toUpperCase() || "DEPT";
    const yearCode = String(new Date().getFullYear()).slice(-2);
    // Atomic upsert + increment
    const { data: seqRow, error: seqErr } = await supabaseAdmin
      .from("matric_sequences")
      .select("last_seq")
      .eq("department_id", link.department_id)
      .eq("year_code", yearCode)
      .maybeSingle();
    if (seqErr) throw new Error(seqErr.message);
    const nextSeq = (seqRow?.last_seq ?? 0) + 1;
    const { error: upErr } = await supabaseAdmin
      .from("matric_sequences")
      .upsert({ department_id: link.department_id, year_code: yearCode, last_seq: nextSeq });
    if (upErr) throw new Error(upErr.message);
    const matric = `${deptCode}/${yearCode}/${String(nextSeq).padStart(4, "0")}`;

    // 3. Create auth user
    const { data: created, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, matric_number: matric },
    });
    if (signUpErr || !created.user) throw new Error(signUpErr?.message ?? "Failed to create account");
    const userId = created.user.id;

    // 4. Upload passport if provided
    let passportUrl: string | null = null;
    if (data.passport_base64) {
      try {
        const base64 = data.passport_base64.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(base64, "base64");
        const fileName = `${userId}/passport.jpg`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("passports")
          .upload(fileName, buf, { contentType: "image/jpeg", upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabaseAdmin.storage.from("passports").getPublicUrl(fileName);
          passportUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.error("Passport upload failed:", e);
      }
    }

    // 5. Insert student row
    const { error: studentErr } = await supabaseAdmin.from("students").insert({
      user_id: userId,
      matric_number: matric,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      level: link.level,
      faculty_id: link.faculty_id,
      department_id: link.department_id,
      gender: data.gender ?? null,
      date_of_birth: data.date_of_birth ?? null,
      address: data.address ?? null,
      state_of_origin: data.state_of_origin ?? null,
      guardian_name: data.guardian_name ?? null,
      guardian_phone: data.guardian_phone ?? null,
      passport_url: passportUrl,
    });
    if (studentErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(studentErr.message);
    }

    // 6. Assign student role
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "student" });

    // 7. Mark link used
    await supabaseAdmin
      .from("registration_links")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", link.id);

    return { ok: true as const, matric_number: matric, email: data.email };
  });

// Resolve matric number → email so students can sign in with matric.
export const resolveMatricToEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ matric_number: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("email")
      .eq("matric_number", data.matric_number.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student?.email) throw new Error("No account found for that matric number");
    return { email: student.email };
  });
