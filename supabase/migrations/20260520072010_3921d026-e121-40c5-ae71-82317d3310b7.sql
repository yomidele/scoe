
REVOKE EXECUTE ON FUNCTION public.handle_carryover_on_result() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_promote_on_session_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_students_to_session(uuid) FROM PUBLIC, anon, authenticated;
-- has_role and current_faculty_id MUST remain callable since RLS policies reference them
