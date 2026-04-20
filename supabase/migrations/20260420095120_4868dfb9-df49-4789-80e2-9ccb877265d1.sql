-- 1. Create student_academic_records table
CREATE TABLE public.student_academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level IN (100, 200, 300, 400)),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'carryover')),
  has_carryover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_session_id)
);

CREATE INDEX idx_sar_session_level ON public.student_academic_records (academic_session_id, level);
CREATE INDEX idx_sar_student ON public.student_academic_records (student_id);

ALTER TABLE public.student_academic_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access" ON public.student_academic_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_sar_updated_at
  BEFORE UPDATE ON public.student_academic_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Promotion function (idempotent, security definer)
CREATE OR REPLACE FUNCTION public.promote_students_to_session(new_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_session_id uuid;
  new_session_created timestamptz;
  has_any_records boolean;
BEGIN
  SELECT created_at INTO new_session_created
  FROM public.academic_sessions WHERE id = new_session_id;

  IF new_session_created IS NULL THEN RETURN; END IF;

  -- Find immediate previous session
  SELECT id INTO prev_session_id
  FROM public.academic_sessions
  WHERE created_at < new_session_created
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if any records exist anywhere
  SELECT EXISTS(SELECT 1 FROM public.student_academic_records) INTO has_any_records;

  IF prev_session_id IS NULL OR NOT has_any_records THEN
    -- First session ever (or no records yet) → seed from students.level
    INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
    SELECT s.id, new_session_id, s.level, 'active', false
    FROM public.students s
    WHERE s.level IN (100, 200, 300, 400)
    ON CONFLICT (student_id, academic_session_id) DO NOTHING;
    RETURN;
  END IF;

  -- Promote from previous session
  -- Case A: level < 400 → +100, status active
  INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
  SELECT sar.student_id, new_session_id, sar.level + 100, 'active', false
  FROM public.student_academic_records sar
  WHERE sar.academic_session_id = prev_session_id
    AND sar.level < 400
    AND sar.status IN ('active', 'carryover')
  ON CONFLICT (student_id, academic_session_id) DO NOTHING;

  -- Case B: level = 400 with carryover → stay 400, status carryover
  INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
  SELECT sar.student_id, new_session_id, 400, 'carryover', true
  FROM public.student_academic_records sar
  WHERE sar.academic_session_id = prev_session_id
    AND sar.level = 400
    AND sar.has_carryover = true
    AND sar.status IN ('active', 'carryover')
  ON CONFLICT (student_id, academic_session_id) DO NOTHING;

  -- Case C: level = 400, no carryover → mark previous record as graduated
  UPDATE public.student_academic_records
  SET status = 'graduated'
  WHERE academic_session_id = prev_session_id
    AND level = 400
    AND has_carryover = false
    AND status = 'active';
END;
$$;

-- 3. Trigger: run promotion on new session insert
CREATE OR REPLACE FUNCTION public.trg_promote_on_session_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.promote_students_to_session(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_session_insert
  AFTER INSERT ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_promote_on_session_insert();

-- 4. Backfill: for each existing session, seed records from students.level
-- (Idempotent thanks to UNIQUE constraint)
INSERT INTO public.student_academic_records (student_id, academic_session_id, level, status, has_carryover)
SELECT s.id, ses.id, s.level, 'active', false
FROM public.students s
CROSS JOIN public.academic_sessions ses
WHERE s.level IN (100, 200, 300, 400)
ON CONFLICT (student_id, academic_session_id) DO NOTHING;