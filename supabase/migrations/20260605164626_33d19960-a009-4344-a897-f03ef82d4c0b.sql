
-- ===== department_admins =====
CREATE TABLE public.department_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  faculty_id uuid NOT NULL,
  department_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_admins TO authenticated;
GRANT ALL ON public.department_admins TO service_role;
ALTER TABLE public.department_admins ENABLE ROW LEVEL SECURITY;

-- ===== lecturers =====
CREATE TABLE public.lecturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  faculty_id uuid NOT NULL,
  department_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecturers TO authenticated;
GRANT ALL ON public.lecturers TO service_role;
ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;

-- ===== course_assignments =====
CREATE TABLE public.course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id uuid NOT NULL REFERENCES public.lecturers(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  session_id uuid NOT NULL,
  semester text NOT NULL,
  department_id uuid NOT NULL,
  faculty_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lecturer_id, course_id, session_id, semester)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_assignments TO authenticated;
GRANT ALL ON public.course_assignments TO service_role;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;

-- ===== helpers (now that tables exist) =====
CREATE OR REPLACE FUNCTION private.current_department_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.department_admins WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.current_lecturer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.lecturers WHERE user_id = auth.uid() LIMIT 1
$$;

-- ===== policies: department_admins =====
CREATE POLICY "Super admin all dept admins" ON public.department_admins
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Faculty admin own faculty dept admins" ON public.department_admins
  FOR ALL TO authenticated
  USING (faculty_id = private.current_faculty_id())
  WITH CHECK (faculty_id = private.current_faculty_id());
CREATE POLICY "Dept admin read self" ON public.department_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_dept_admins_updated BEFORE UPDATE ON public.department_admins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== policies: lecturers =====
CREATE POLICY "Super admin all lecturers" ON public.lecturers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Faculty admin own faculty lecturers" ON public.lecturers
  FOR ALL TO authenticated
  USING (faculty_id = private.current_faculty_id())
  WITH CHECK (faculty_id = private.current_faculty_id());
CREATE POLICY "Dept admin own dept lecturers" ON public.lecturers
  FOR ALL TO authenticated
  USING (department_id = private.current_department_id())
  WITH CHECK (department_id = private.current_department_id());
CREATE POLICY "Lecturer read self" ON public.lecturers
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_lecturers_updated BEFORE UPDATE ON public.lecturers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== policies: course_assignments =====
CREATE POLICY "Super admin all assignments" ON public.course_assignments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Faculty admin own assignments" ON public.course_assignments
  FOR ALL TO authenticated
  USING (faculty_id = private.current_faculty_id())
  WITH CHECK (faculty_id = private.current_faculty_id());
CREATE POLICY "Dept admin own dept assignments" ON public.course_assignments
  FOR ALL TO authenticated
  USING (department_id = private.current_department_id())
  WITH CHECK (department_id = private.current_department_id());
CREATE POLICY "Lecturer read own assignments" ON public.course_assignments
  FOR SELECT TO authenticated USING (lecturer_id = private.current_lecturer_id());

-- ===== results workflow =====
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS entered_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_reason text;

-- Preserve everything: existing results become 'published' so students keep seeing them
UPDATE public.results
SET status = 'published', published_at = COALESCE(published_at, now())
WHERE status = 'draft' AND created_at < now();

DROP POLICY IF EXISTS "Student read own results" ON public.results;
CREATE POLICY "Student read own published results" ON public.results
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "Lecturer manage own draft results" ON public.results
  FOR ALL TO authenticated
  USING (
    status IN ('draft','submitted')
    AND EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = results.course_id
        AND ca.session_id = results.session_id
        AND ca.semester  = results.semester
        AND ca.lecturer_id = private.current_lecturer_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = results.course_id
        AND ca.session_id = results.session_id
        AND ca.semester  = results.semester
        AND ca.lecturer_id = private.current_lecturer_id()
    )
  );

CREATE POLICY "Lecturer read own assigned results" ON public.results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = results.course_id
        AND ca.session_id = results.session_id
        AND ca.semester  = results.semester
        AND ca.lecturer_id = private.current_lecturer_id()
    )
  );

CREATE POLICY "Dept admin own dept results" ON public.results
  FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE department_id = private.current_department_id()))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE department_id = private.current_department_id()));

-- ===== Dept admin scope on related tables =====
CREATE POLICY "Dept admin own dept students" ON public.students
  FOR ALL TO authenticated
  USING (department_id = private.current_department_id())
  WITH CHECK (department_id = private.current_department_id());

CREATE POLICY "Dept admin own dept courses" ON public.courses
  FOR ALL TO authenticated
  USING (department_id = private.current_department_id())
  WITH CHECK (department_id = private.current_department_id());

CREATE POLICY "Dept admin own dept carryovers" ON public.carryovers
  FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE department_id = private.current_department_id()))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE department_id = private.current_department_id()));
