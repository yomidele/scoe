-- Add total_score (0-100) to results so we can store imported single-figure scores
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS total_score numeric;

-- Add department to students (e.g. "Guidance & Counselling")
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS department text;