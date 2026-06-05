
CREATE OR REPLACE FUNCTION public.next_matric_seq(_department_id uuid, _year_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  INSERT INTO public.matric_sequences (department_id, year_code, last_seq)
  VALUES (_department_id, _year_code, 1)
  ON CONFLICT (department_id, year_code)
  DO UPDATE SET last_seq = matric_sequences.last_seq + 1
  RETURNING last_seq INTO next_val;
  RETURN next_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_matric_seq(uuid, text) TO authenticated, service_role;
