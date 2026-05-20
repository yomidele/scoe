
-- Registration links: faculty/super admin generates a token; student uses it to self-register
CREATE TABLE IF NOT EXISTS public.registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  department_id uuid NOT NULL,
  level integer NOT NULL DEFAULT 100,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  used_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin all reg links" ON public.registration_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Faculty admin own faculty reg links" ON public.registration_links
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id())
  WITH CHECK (faculty_id = current_faculty_id());

-- Public lookup by token (anon allowed to check token validity)
CREATE POLICY "Public read by token" ON public.registration_links
  FOR SELECT TO anon, authenticated
  USING (used_at IS NULL AND expires_at > now());

-- Matric sequence tracker per dept/year
CREATE TABLE IF NOT EXISTS public.matric_sequences (
  department_id uuid NOT NULL,
  year_code text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (department_id, year_code)
);

ALTER TABLE public.matric_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin manage matric seq" ON public.matric_sequences
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Auto carryover trigger: when a result has grade F (total<40), insert carryover; when passing, mark cleared
CREATE OR REPLACE FUNCTION public.handle_carryover_on_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  v_total := COALESCE(NEW.total_score, NEW.ca_score + NEW.exam_score);

  IF v_total < 40 THEN
    -- Insert carryover if not already present for this student+course+session
    INSERT INTO public.carryovers (student_id, course_id, faculty_id, failed_session_id, failed_level, failed_semester, status)
    VALUES (NEW.student_id, NEW.course_id, NEW.faculty_id, NEW.session_id, NEW.level, NEW.semester, 'pending')
    ON CONFLICT DO NOTHING;
  ELSE
    -- Passed: mark any existing pending carryover for this student+course as cleared
    UPDATE public.carryovers
      SET status = 'cleared', cleared_session_id = NEW.session_id, updated_at = now()
      WHERE student_id = NEW.student_id
        AND course_id = NEW.course_id
        AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carryover_on_result_insert ON public.results;
CREATE TRIGGER trg_carryover_on_result_insert
  AFTER INSERT ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.handle_carryover_on_result();

DROP TRIGGER IF EXISTS trg_carryover_on_result_update ON public.results;
CREATE TRIGGER trg_carryover_on_result_update
  AFTER UPDATE OF ca_score, exam_score, total_score ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.handle_carryover_on_result();

-- Unique constraint for carryover dedup (one pending row per student+course+failed_session)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_carryover_pending
  ON public.carryovers(student_id, course_id, failed_session_id);

-- Seed academic_settings if empty
INSERT INTO public.academic_settings (min_units, max_units)
SELECT 15, 24
WHERE NOT EXISTS (SELECT 1 FROM public.academic_settings);

-- Backfill any existing F results into carryovers
INSERT INTO public.carryovers (student_id, course_id, faculty_id, failed_session_id, failed_level, failed_semester, status)
SELECT r.student_id, r.course_id, r.faculty_id, r.session_id, r.level, r.semester, 'pending'
FROM public.results r
WHERE COALESCE(r.total_score, r.ca_score + r.exam_score) < 40
ON CONFLICT DO NOTHING;
