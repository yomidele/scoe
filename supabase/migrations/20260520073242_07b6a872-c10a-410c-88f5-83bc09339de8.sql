-- Move RLS helper logic behind a private schema so it is not exposed as a public API function.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.current_faculty_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT faculty_id
  FROM public.faculty_admins
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_faculty_id() TO authenticated;

-- Rebuild dependent policies to use the private helper functions.
DROP POLICY IF EXISTS "Super admin manage sessions" ON public.academic_sessions;
CREATE POLICY "Super admin manage sessions" ON public.academic_sessions
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admin manage settings" ON public.academic_settings;
CREATE POLICY "Super admin manage settings" ON public.academic_settings
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admin all carryovers" ON public.carryovers;
DROP POLICY IF EXISTS "Faculty admin own faculty carryovers" ON public.carryovers;
CREATE POLICY "Super admin all carryovers" ON public.carryovers
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty carryovers" ON public.carryovers
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Super admin all reg items" ON public.course_registration_items;
DROP POLICY IF EXISTS "Faculty admin own faculty reg items" ON public.course_registration_items;
CREATE POLICY "Super admin all reg items" ON public.course_registration_items
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty reg items" ON public.course_registration_items
FOR ALL TO authenticated
USING (registration_id IN (SELECT id FROM public.course_registrations WHERE faculty_id = private.current_faculty_id()))
WITH CHECK (registration_id IN (SELECT id FROM public.course_registrations WHERE faculty_id = private.current_faculty_id()));

DROP POLICY IF EXISTS "Super admin all regs" ON public.course_registrations;
DROP POLICY IF EXISTS "Faculty admin own faculty regs" ON public.course_registrations;
CREATE POLICY "Super admin all regs" ON public.course_registrations
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty regs" ON public.course_registrations
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Super admin manage courses" ON public.courses;
DROP POLICY IF EXISTS "Faculty admin manage own courses" ON public.courses;
CREATE POLICY "Super admin manage courses" ON public.courses
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin manage own courses" ON public.courses
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Super admin manage departments" ON public.departments;
DROP POLICY IF EXISTS "Faculty admin manage own departments" ON public.departments;
CREATE POLICY "Super admin manage departments" ON public.departments
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin manage own departments" ON public.departments
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Super admin manage faculties" ON public.faculties;
CREATE POLICY "Super admin manage faculties" ON public.faculties
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Faculty admin read self" ON public.faculty_admins;
DROP POLICY IF EXISTS "Super admin manage faculty_admins" ON public.faculty_admins;
CREATE POLICY "Faculty admin read self" ON public.faculty_admins
FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admin manage faculty_admins" ON public.faculty_admins
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admin manage matric seq" ON public.matric_sequences;
CREATE POLICY "Super admin manage matric seq" ON public.matric_sequences
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admin all reg links" ON public.registration_links;
DROP POLICY IF EXISTS "Faculty admin own faculty reg links" ON public.registration_links;
CREATE POLICY "Super admin all reg links" ON public.registration_links
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty reg links" ON public.registration_links
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Super admin all results" ON public.results;
DROP POLICY IF EXISTS "Faculty admin own faculty results" ON public.results;
CREATE POLICY "Super admin all results" ON public.results
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty results" ON public.results
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Super admin all SAR" ON public.student_academic_records;
DROP POLICY IF EXISTS "Faculty admin own faculty SAR" ON public.student_academic_records;
CREATE POLICY "Super admin all SAR" ON public.student_academic_records
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty SAR" ON public.student_academic_records
FOR ALL TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE faculty_id = private.current_faculty_id()))
WITH CHECK (student_id IN (SELECT id FROM public.students WHERE faculty_id = private.current_faculty_id()));

DROP POLICY IF EXISTS "Super admin all students" ON public.students;
DROP POLICY IF EXISTS "Faculty admin own faculty students" ON public.students;
CREATE POLICY "Super admin all students" ON public.students
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Faculty admin own faculty students" ON public.students
FOR ALL TO authenticated
USING (faculty_id = private.current_faculty_id())
WITH CHECK (faculty_id = private.current_faculty_id());

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin manage roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admin manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Prevent public API execution of the old exposed helper functions.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_faculty_id() FROM PUBLIC, anon, authenticated;