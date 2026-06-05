
REVOKE EXECUTE ON FUNCTION public.next_matric_seq(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_matric_seq(uuid, text) TO service_role;
