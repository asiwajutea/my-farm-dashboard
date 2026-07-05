
-- 1. Set immutable search_path on fmt_seed
ALTER FUNCTION public.fmt_seed(numeric) SET search_path = public;

-- 2. Lock down SECURITY DEFINER functions in public schema.
-- Revoke EXECUTE from PUBLIC and anon on every function in public, then
-- grant EXECUTE to authenticated. Whitelist the two functions that must be
-- callable by anon (used during signup before a session exists).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END $$;

-- Allow anon to call the pre-auth signup helpers.
GRANT EXECUTE ON FUNCTION public.lookup_referrer(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon;
