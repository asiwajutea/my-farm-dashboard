-- =========================================================
-- Profile: live username availability + default preset avatar at signup
-- =========================================================

-- 1. Username availability check -------------------------------------------
-- profiles RLS restricts SELECT to the owner, so checking another Farmer's
-- handle requires a SECURITY DEFINER function. Case-insensitive; excludes the
-- caller's own current username so editing-without-changing reads as available.
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(trim(p_username))
      AND id <> auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated, service_role;

-- 2. Default preset avatar at signup ---------------------------------------
-- New Farmers get a preset avatar (public/avatars/01.svg) when the signup
-- metadata carries no avatar_url. Mirrors the latest handle_new_user body.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref_code text;
  v_ref_id   uuid;
BEGIN
  v_ref_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF length(v_ref_code) > 0 THEN
    SELECT id INTO v_ref_id FROM public.profiles WHERE referral_code = v_ref_code;
    IF v_ref_id = NEW.id THEN v_ref_id := NULL; END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), '/avatars/01.svg'),
    public.generate_referral_code(),
    v_ref_id
  );

  INSERT INTO public.wallets (user_id, kind) VALUES (NEW.id, 'primary'), (NEW.id, 'farming')
  ON CONFLICT (user_id, kind) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farmer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $$;

-- 3. Backfill: give existing Farmers without an avatar the default preset ---
UPDATE public.profiles
  SET avatar_url = '/avatars/01.svg'
  WHERE avatar_url IS NULL OR length(trim(avatar_url)) = 0;
