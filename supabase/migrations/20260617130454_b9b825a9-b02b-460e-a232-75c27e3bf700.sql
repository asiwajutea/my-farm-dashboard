CREATE OR REPLACE FUNCTION public.get_my_downline_counts()
RETURNS TABLE(gen1 integer, gen2 integer, gen3 integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_g1 uuid[];
  v_g2 uuid[];
  v_g3_count int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_g1 FROM public.profiles WHERE referred_by = v_user;
  IF array_length(v_g1, 1) IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_g2 FROM public.profiles WHERE referred_by = ANY(v_g1);
  ELSE
    v_g2 := ARRAY[]::uuid[];
  END IF;
  IF array_length(v_g2, 1) IS NOT NULL THEN
    SELECT count(*) INTO v_g3_count FROM public.profiles WHERE referred_by = ANY(v_g2);
  END IF;
  gen1 := COALESCE(array_length(v_g1, 1), 0);
  gen2 := COALESCE(array_length(v_g2, 1), 0);
  gen3 := v_g3_count;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_downlines()
RETURNS TABLE(id uuid, display_name text, username text, generation integer, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_g1 uuid[];
  v_g2 uuid[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT p.id, p.display_name, p.username, 1, p.created_at
    FROM public.profiles p WHERE p.referred_by = v_user;
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO v_g1 FROM public.profiles p WHERE p.referred_by = v_user;
  IF array_length(v_g1, 1) IS NOT NULL THEN
    RETURN QUERY
      SELECT p.id, p.display_name, p.username, 2, p.created_at
      FROM public.profiles p WHERE p.referred_by = ANY(v_g1);
    SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO v_g2 FROM public.profiles p WHERE p.referred_by = ANY(v_g1);
    IF array_length(v_g2, 1) IS NOT NULL THEN
      RETURN QUERY
        SELECT p.id, p.display_name, p.username, 3, p.created_at
        FROM public.profiles p WHERE p.referred_by = ANY(v_g2);
    END IF;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_downline_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_downlines() TO authenticated;