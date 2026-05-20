
-- ============================================================
-- PHASE 1: Multi-faculty foundation
-- ============================================================

-- 1. ROLES ENUM + USER_ROLES TABLE -------------------------
CREATE TYPE public.app_role AS ENUM ('super_admin', 'faculty_admin', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. FACULTIES + DEPARTMENTS -------------------------------
CREATE TABLE public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, code)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 3. FACULTY ADMINS ---------------------------------------
CREATE TABLE public.faculty_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  faculty_id uuid NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faculty_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_faculty_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT faculty_id FROM public.faculty_admins WHERE user_id = auth.uid() LIMIT 1
$$;

-- 4. SEED DEFAULT FACULTY + DEPARTMENT --------------------
INSERT INTO public.faculties (name, code) VALUES ('Default Faculty', 'DEF');
INSERT INTO public.departments (faculty_id, name, code)
  SELECT id, 'General Studies', 'GST' FROM public.faculties WHERE code = 'DEF';

-- 5. EXTEND STUDENTS --------------------------------------
ALTER TABLE public.students
  ADD COLUMN user_id uuid UNIQUE,
  ADD COLUMN faculty_id uuid REFERENCES public.faculties(id),
  ADD COLUMN department_id uuid REFERENCES public.departments(id),
  ADD COLUMN passport_url text,
  ADD COLUMN gender text,
  ADD COLUMN date_of_birth date,
  ADD COLUMN address text,
  ADD COLUMN state_of_origin text,
  ADD COLUMN guardian_name text,
  ADD COLUMN guardian_phone text,
  ADD COLUMN email text,
  ADD COLUMN phone text;

UPDATE public.students SET
  faculty_id = (SELECT id FROM public.faculties WHERE code='DEF'),
  department_id = (SELECT id FROM public.departments WHERE code='GST')
WHERE faculty_id IS NULL;

ALTER TABLE public.students ALTER COLUMN faculty_id SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN department_id SET NOT NULL;

-- 6. EXTEND COURSES ---------------------------------------
ALTER TABLE public.courses
  ADD COLUMN faculty_id uuid REFERENCES public.faculties(id),
  ADD COLUMN department_id uuid REFERENCES public.departments(id),
  ADD COLUMN course_type text NOT NULL DEFAULT 'core';

UPDATE public.courses SET
  faculty_id = (SELECT id FROM public.faculties WHERE code='DEF'),
  department_id = (SELECT id FROM public.departments WHERE code='GST')
WHERE faculty_id IS NULL;

ALTER TABLE public.courses ALTER COLUMN faculty_id SET NOT NULL;

-- 7. EXTEND RESULTS ---------------------------------------
ALTER TABLE public.results
  ADD COLUMN faculty_id uuid REFERENCES public.faculties(id),
  ADD COLUMN department_id uuid REFERENCES public.departments(id);

UPDATE public.results r SET
  faculty_id = s.faculty_id,
  department_id = s.department_id
FROM public.students s WHERE s.id = r.student_id AND r.faculty_id IS NULL;

ALTER TABLE public.results ALTER COLUMN faculty_id SET NOT NULL;

-- 8. CARRYOVERS -------------------------------------------
CREATE TABLE public.carryovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES public.faculties(id),
  failed_session_id uuid NOT NULL REFERENCES public.academic_sessions(id),
  failed_semester text NOT NULL,
  failed_level integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  cleared_session_id uuid REFERENCES public.academic_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id, failed_session_id)
);
ALTER TABLE public.carryovers ENABLE ROW LEVEL SECURITY;

-- 9. COURSE REGISTRATIONS ---------------------------------
CREATE TABLE public.course_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id),
  semester text NOT NULL,
  level integer NOT NULL,
  faculty_id uuid NOT NULL REFERENCES public.faculties(id),
  total_units integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, semester)
);
ALTER TABLE public.course_registrations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_registration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.course_registrations(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id),
  is_carryover boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  carryover_id uuid REFERENCES public.carryovers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, course_id)
);
ALTER TABLE public.course_registration_items ENABLE ROW LEVEL SECURITY;

-- 10. ACADEMIC SETTINGS -----------------------------------
CREATE TABLE public.academic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_units integer NOT NULL DEFAULT 15,
  max_units integer NOT NULL DEFAULT 24,
  current_session_id uuid REFERENCES public.academic_sessions(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.academic_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.academic_settings DEFAULT VALUES;

-- 11. updated_at TRIGGERS ---------------------------------
CREATE TRIGGER tg_faculties_updated BEFORE UPDATE ON public.faculties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_faculty_admins_updated BEFORE UPDATE ON public.faculty_admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_carryovers_updated BEFORE UPDATE ON public.carryovers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_course_regs_updated BEFORE UPDATE ON public.course_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. RLS POLICIES ----------------------------------------
-- Drop legacy blanket policies
DROP POLICY IF EXISTS "auth full access" ON public.academic_sessions;
DROP POLICY IF EXISTS "auth full access" ON public.courses;
DROP POLICY IF EXISTS "auth full access" ON public.results;
DROP POLICY IF EXISTS "auth full access" ON public.students;
DROP POLICY IF EXISTS "auth full access" ON public.student_academic_records;

-- user_roles
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- faculties
CREATE POLICY "Authenticated read faculties" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage faculties" ON public.faculties FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- departments
CREATE POLICY "Authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin manage own departments" ON public.departments FOR ALL TO authenticated USING (faculty_id = public.current_faculty_id()) WITH CHECK (faculty_id = public.current_faculty_id());

-- faculty_admins
CREATE POLICY "Faculty admin read self" ON public.faculty_admins FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage faculty_admins" ON public.faculty_admins FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- academic_sessions (read all authenticated, mutate super_admin)
CREATE POLICY "Authenticated read sessions" ON public.academic_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage sessions" ON public.academic_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- students
CREATE POLICY "Super admin all students" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin own faculty students" ON public.students FOR ALL TO authenticated USING (faculty_id = public.current_faculty_id()) WITH CHECK (faculty_id = public.current_faculty_id());
CREATE POLICY "Student read self" ON public.students FOR SELECT TO authenticated USING (user_id = auth.uid());

-- courses
CREATE POLICY "Authenticated read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin manage own courses" ON public.courses FOR ALL TO authenticated USING (faculty_id = public.current_faculty_id()) WITH CHECK (faculty_id = public.current_faculty_id());

-- results
CREATE POLICY "Super admin all results" ON public.results FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin own faculty results" ON public.results FOR ALL TO authenticated USING (faculty_id = public.current_faculty_id()) WITH CHECK (faculty_id = public.current_faculty_id());
CREATE POLICY "Student read own results" ON public.results FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- student_academic_records
CREATE POLICY "Super admin all SAR" ON public.student_academic_records FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin own faculty SAR" ON public.student_academic_records FOR ALL TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE faculty_id = public.current_faculty_id())) WITH CHECK (student_id IN (SELECT id FROM public.students WHERE faculty_id = public.current_faculty_id()));
CREATE POLICY "Student read own SAR" ON public.student_academic_records FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- carryovers
CREATE POLICY "Super admin all carryovers" ON public.carryovers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin own faculty carryovers" ON public.carryovers FOR ALL TO authenticated USING (faculty_id = public.current_faculty_id()) WITH CHECK (faculty_id = public.current_faculty_id());
CREATE POLICY "Student read own carryovers" ON public.carryovers FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- course_registrations
CREATE POLICY "Super admin all regs" ON public.course_registrations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin own faculty regs" ON public.course_registrations FOR ALL TO authenticated USING (faculty_id = public.current_faculty_id()) WITH CHECK (faculty_id = public.current_faculty_id());
CREATE POLICY "Student manage own regs" ON public.course_registrations FOR ALL TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())) WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- course_registration_items
CREATE POLICY "Super admin all reg items" ON public.course_registration_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Faculty admin own faculty reg items" ON public.course_registration_items FOR ALL TO authenticated USING (registration_id IN (SELECT id FROM public.course_registrations WHERE faculty_id = public.current_faculty_id())) WITH CHECK (registration_id IN (SELECT id FROM public.course_registrations WHERE faculty_id = public.current_faculty_id()));
CREATE POLICY "Student manage own reg items" ON public.course_registration_items FOR ALL TO authenticated USING (registration_id IN (SELECT cr.id FROM public.course_registrations cr JOIN public.students s ON s.id = cr.student_id WHERE s.user_id = auth.uid())) WITH CHECK (registration_id IN (SELECT cr.id FROM public.course_registrations cr JOIN public.students s ON s.id = cr.student_id WHERE s.user_id = auth.uid()));

-- academic_settings
CREATE POLICY "Authenticated read settings" ON public.academic_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage settings" ON public.academic_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- 13. STORAGE BUCKET: passports ---------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('passports', 'passports', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Passport public read" ON storage.objects FOR SELECT USING (bucket_id = 'passports');
CREATE POLICY "Passport owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'passports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Passport owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'passports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Passport admin manage" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'passports' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'faculty_admin'))) WITH CHECK (bucket_id = 'passports' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'faculty_admin')));

-- 14. PROMOTE EXISTING DEMO ADMIN TO super_admin ----------
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users WHERE email = 'admin@tsu.demo'
ON CONFLICT DO NOTHING;
