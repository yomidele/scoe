# University Management Platform Upgrade — Phased Plan

This is a very large scope (3 portals, role isolation, multi-faculty data model, student registration, passport uploads, course registration with live unit counter, carryover automation, analytics, etc.). It cannot be safely shipped in a single turn without breaking the working result engine. I'll deliver it in approved phases, each phase independently usable and reviewable.

## Guiding rules
- **Preserve** the existing engine: `grading.ts`, GPA/CGPA logic, `promote_students_to_session`, `student_academic_records`, spreadsheet/transcript export. No rewrites — only additive changes.
- **Backend-enforced isolation** via `faculty_id` on every domain table + RLS policies using a `has_role` / `user_faculty()` security-definer function. Frontend hiding is treated as UX only.
- **Roles table** (`user_roles` with enum `app_role`: `super_admin`, `faculty_admin`, `student`) — never on profiles. Plus `faculty_admins.faculty_id` mapping and `students.user_id` linking.
- **One Supabase Auth** instance, three login *pages* (`/admin/login`, `/faculty/login`, `/student/login`) that all sign in via Supabase but redirect by role. This is simpler and safer than three parallel auth systems and meets the "separate portals" requirement at the UX layer.
- Routes grouped under `_admin`, `_faculty`, `_student` pathless layouts, each with `beforeLoad` role gate.

## Phase 1 — Foundation (this approval)
Database + auth + role routing skeleton. No UI for new portals yet beyond shells.

1. **Migration**:
   - `faculties` (name, code), `departments` (faculty_id, name, code).
   - `app_role` enum + `user_roles` table + `has_role(uuid, app_role)` security definer.
   - `faculty_admins` (user_id, faculty_id, full_name, email, phone).
   - Add `faculty_id`, `department_id`, `user_id`, `passport_url`, `gender`, `dob`, `address`, `state_of_origin`, `guardian_*` to `students` (nullable for backfill).
   - Add `faculty_id`, `department_id` to `courses` and `results`.
   - New tables: `carryovers`, `course_registrations`, `course_registration_items`, `academic_settings` (max/min units).
   - Tighten RLS: replace blanket `auth full access` with role+faculty scoped policies on every table.
   - Storage bucket `passports` (public read, owner write) + policies.
   - Seed one "Default Faculty" + assign all existing students/courses to it so current data keeps working.
2. **Auth wiring**:
   - Promote current demo admin to `super_admin` row in `user_roles`.
   - `useAuthSession` returns role; add `useRole()` hook.
3. **Routing skeleton**:
   - `_admin.tsx`, `_faculty.tsx`, `_student.tsx` layout routes with role gates + redirect.
   - `/admin/login`, `/faculty/login`, `/student/login` pages (students sign in with matric number → resolved to email server-side).
   - Move existing admin pages under `_admin/` (sessions, courses, students, results, transcripts, etc.) — paths preserved via redirects.

## Phase 2 — Super Admin
- `/admin/faculties` CRUD.
- `/admin/faculty-admins` create (server fn that creates auth user + role + faculty_admins row via service role).
- `/admin/students` university-wide view.
- `/admin/analytics` cross-faculty stats.

## Phase 3 — Faculty Admin
- `/faculty/dashboard` faculty-scoped stats.
- `/faculty/students`, `/faculty/courses`, `/faculty/results` (reuses existing result-entry / results pages, filtered by faculty).
- `/faculty/registrations` review.

## Phase 4 — Student Registration & Portal
- Public `/student/register?token=...` (registration links with expiry).
- Passport upload + crop.
- Auto matric generation (`{DEPTCODE}/{YY}/{SEQ}`).
- `/student/dashboard`, `/student/profile`, `/student/results`, `/student/gpa`, `/student/carryovers`, `/student/courses`, `/student/settings`.
- Result slip PDF (reuses transcript generator).

## Phase 5 — Course Registration + Carryover Automation
- Auto-detect failed courses from `results` → write `carryovers` rows scoped to same semester parity.
- Registration UI: locked carryovers + live unit counter + min/max enforcement.
- Server fn validates totals before insert.

## Phase 6 — Polish
- Analytics charts (recharts), responsive sidebar, animations, security audit pass.

## Technical notes
- All cross-tenant queries go through `createServerFn` + `requireSupabaseAuth`; RLS is the backstop.
- Faculty Admin server fns read `faculty_id` from `faculty_admins` via `userId`, never trust client input.
- Existing `result-entry.tsx`, `results.tsx`, `transcripts.tsx`, `spreadsheet-generator.ts` stay as-is; new portal pages thin-wrap them with faculty filters.
- Storage: `passports/{user_id}.jpg`, public bucket, RLS by `auth.uid()::text = (storage.foldername(name))[1]`.

## What I'll ship on approval of this plan
**Phase 1 only**: the migration + auth/role/routing skeleton. Existing admin functionality keeps working at the same URLs. After you confirm Phase 1 boots cleanly (login still works, existing pages still render, no data loss), I'll proceed to Phase 2.

Reply **approve** to start Phase 1, or tell me which phases to reorder/cut.
