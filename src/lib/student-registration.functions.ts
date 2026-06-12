import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public: validate a registration token. General links: no faculty/department/level baked in.
export const validateRegistrationToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: link, error } = await supabaseAdmin
      .from("registration_links")
      .select("id, token, expires_at, use_count, max_uses, label")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link) return { valid: false as const, reason: "Invalid token" };
    if (new Date(link.expires_at) < new Date()) return { valid: false as const, reason: "This link has expired" };
    if (link.max_uses !== null && link.use_count >= link.max_uses) {
      return { valid: false as const, reason: "This link has reached its maximum number of uses" };
    }
    return { valid: true as const, link: { id: link.id, label: link.label ?? null } };
  });

// Public: list faculties + departments so the student can pick them.
export const listFacultiesAndDepartments = createServerFn({ method: "POST" })
  .handler(async () => {
    const [{ data: faculties }, { data: departments }] = await Promise.all([
      supabaseAdmin.from("faculties").select("id, name, code").order("name"),
      supabaseAdmin.from("departments").select("id, name, code, faculty_id").order("name"),
    ]);
    return { faculties: faculties ?? [], departments: departments ?? [] };
  });

// Public: register student. Student chooses faculty/department/level themselves.
export const registerStudentWithToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        faculty_id: z.string().uuid(),
        department_id: z.string().uuid(),
        level: z.number().int().min(100).max(600),
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
    // 1. Validate link
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("registration_links")
      .select("id, expires_at, use_count, max_uses")
      .eq("token", data.token)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link) throw new Error("Invalid registration link");
    if (new Date(link.expires_at) < new Date()) throw new Error("Registration link has expired");
    if (link.max_uses !== null && link.use_count >= link.max_uses) {
      throw new Error("Registration link has reached its maximum number of uses");
    }

    // 2. Verify faculty + department pair belongs together (and load faculty code for matric)
    const [{ data: dept, error: deptErr }, { data: fac, error: facErr }] = await Promise.all([
      supabaseAdmin
        .from("departments")
        .select("id, code, faculty_id")
        .eq("id", data.department_id)
        .maybeSingle(),
      supabaseAdmin
        .from("faculties")
        .select("id, code")
        .eq("id", data.faculty_id)
        .maybeSingle(),
    ]);
    if (deptErr) throw new Error(deptErr.message);
    if (facErr) throw new Error(facErr.message);
    if (!dept || dept.faculty_id !== data.faculty_id) {
      throw new Error("Selected department does not belong to the selected faculty");
    }
    if (!fac) throw new Error("Faculty not found");

    // 3. Reserve matric sequence atomically — format: TSU/<FAC>/<DEPT>/<YY>/<NNNN>
    const yearCode = String(new Date().getFullYear()).slice(-2);
    const facCode = (fac.code ?? "FAC").toUpperCase();
    const deptCode = (dept.code ?? "DEPT").toUpperCase();
    const { data: seq, error: seqErr } = await supabaseAdmin.rpc("next_matric_seq", {
      _department_id: data.department_id,
      _year_code: yearCode,
    });
    if (seqErr || typeof seq !== "number") throw new Error(seqErr?.message ?? "Could not allocate matric number");
    const matric = `TSU/${facCode}/${deptCode}/${yearCode}/${String(seq).padStart(4, "0")}`;

    // 4. Create auth user
    const { data: created, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, matric_number: matric },
    });
    if (signUpErr || !created.user) throw new Error(signUpErr?.message ?? "Failed to create account");
    const userId = created.user.id;

    // 5. Upload passport if provided
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

    // 6. Insert student row
    const studentRow = {
      user_id: userId,
      matric_number: matric,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      level: data.level,
      faculty_id: data.faculty_id,
      department_id: data.department_id,
      gender: data.gender ?? null,
      date_of_birth: data.date_of_birth ?? null,
      address: data.address ?? null,
      state_of_origin: data.state_of_origin ?? null,
      guardian_name: data.guardian_name ?? null,
      guardian_phone: data.guardian_phone ?? null,
      passport_url: passportUrl,
    };
    const { error: studentErr } = await supabaseAdmin.from("students").insert(studentRow as never);
    if (studentErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(studentErr.message);
    }

    // 7. Assign student role
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "student" });

    // 8. Increment use count
    await supabaseAdmin
      .from("registration_links")
      .update({ use_count: link.use_count + 1, used_at: new Date().toISOString(), used_by: userId })
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
