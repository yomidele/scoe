-- Restore permission for access-policy helper functions used by RLS.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_faculty_id() TO authenticated;

-- Ensure authenticated users have the normal table privileges needed for RLS policies to evaluate.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.carryovers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_registration_items TO authenticated;
GRANT SELECT ON TABLE public.academic_sessions TO authenticated;
GRANT SELECT ON TABLE public.academic_settings TO authenticated;
GRANT SELECT ON TABLE public.faculties TO authenticated;
GRANT SELECT ON TABLE public.departments TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.faculty_admins TO authenticated;

-- Reattach automatic carryover processing if the trigger was not created previously.
DROP TRIGGER IF EXISTS trg_handle_carryover_on_result ON public.results;
CREATE TRIGGER trg_handle_carryover_on_result
AFTER INSERT OR UPDATE ON public.results
FOR EACH ROW
EXECUTE FUNCTION public.handle_carryover_on_result();