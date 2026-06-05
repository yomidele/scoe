
ALTER TABLE public.registration_links ALTER COLUMN faculty_id DROP NOT NULL;
ALTER TABLE public.registration_links ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE public.registration_links ALTER COLUMN level DROP NOT NULL;
ALTER TABLE public.registration_links ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.registration_links ADD COLUMN IF NOT EXISTS max_uses integer;
ALTER TABLE public.registration_links ADD COLUMN IF NOT EXISTS label text;

DROP POLICY IF EXISTS "Public read by token" ON public.registration_links;
CREATE POLICY "Public read by token" ON public.registration_links
  FOR SELECT TO anon, authenticated
  USING (expires_at > now() AND (max_uses IS NULL OR use_count < max_uses));
