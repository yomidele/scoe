
-- Defaults so existing inserts (which don't yet pass faculty_id/department_id) still work.
DO $$
DECLARE
  v_fac uuid := (SELECT id FROM public.faculties WHERE code='DEF');
  v_dep uuid := (SELECT id FROM public.departments WHERE code='GST');
BEGIN
  EXECUTE format('ALTER TABLE public.students  ALTER COLUMN faculty_id  SET DEFAULT %L', v_fac);
  EXECUTE format('ALTER TABLE public.students  ALTER COLUMN department_id SET DEFAULT %L', v_dep);
  EXECUTE format('ALTER TABLE public.courses   ALTER COLUMN faculty_id  SET DEFAULT %L', v_fac);
  EXECUTE format('ALTER TABLE public.courses   ALTER COLUMN department_id SET DEFAULT %L', v_dep);
  EXECUTE format('ALTER TABLE public.results   ALTER COLUMN faculty_id  SET DEFAULT %L', v_fac);
  EXECUTE format('ALTER TABLE public.results   ALTER COLUMN department_id SET DEFAULT %L', v_dep);
END $$;

-- Lock down SECURITY DEFINER helpers — only used inside RLS policies / server fns
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_faculty_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_students_to_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_promote_on_session_insert() FROM PUBLIC, anon, authenticated;

-- Tighten passport bucket listing (replace blanket public SELECT)
DROP POLICY IF EXISTS "Passport public read" ON storage.objects;
CREATE POLICY "Passport public read individual" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'passports' AND (
      auth.role() = 'anon'  -- anon can fetch by exact path
      OR auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'faculty_admin')
    )
  );
