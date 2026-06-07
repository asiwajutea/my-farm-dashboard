
DROP VIEW IF EXISTS public.profiles_public;

CREATE OR REPLACE FUNCTION public.find_profile_by_handle(handle text)
RETURNS TABLE (id uuid, display_name text, username text, avatar_url text, referral_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.avatar_url, p.referral_code
  FROM public.profiles p
  WHERE p.username = lower(trim(handle))
     OR p.referral_code = upper(trim(handle))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_profile_by_handle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_by_handle(text) TO authenticated;
