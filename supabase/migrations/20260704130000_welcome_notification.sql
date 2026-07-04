-- =========================================================
-- Welcome Notification
-- Fires a 'welcome' notification the moment a new profile
-- row is created (covers email signup, future OAuth, and
-- any admin-created account path).
--
-- Also backfills a welcome notification for any existing
-- users who have no notifications yet (e.g. dakintuyi@gmail.com).
-- =========================================================

-- 1. Ensure 'welcome' exists in notification_kind enum --------------------
-- (It is already present in notification-meta.ts; this guards the DB side.)
DO $$ BEGIN
  ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'welcome';
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. Trigger function — fires on every new profile row --------------------
CREATE OR REPLACE FUNCTION public.tg_notify_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(
    NULLIF(trim(NEW.display_name), ''),
    'Farmer'
  );

  PERFORM public.notify_user(
    NEW.id,
    'welcome'::public.notification_kind,
    'Welcome to VFarmers, ' || v_name || '! 🌱',
    'Your account is ready. Deposit Seeds, start a farming cycle, and watch your rewards grow. Share your referral code to earn commissions.',
    'profiles',
    NEW.id
  );

  RETURN NEW;
END $$;

-- 3. Attach trigger to profiles INSERT ------------------------------------
DROP TRIGGER IF EXISTS notify_welcome ON public.profiles;
CREATE TRIGGER notify_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_welcome();

-- 4. Backfill — send a welcome notification to any existing user who has
--    zero notifications (catches accounts created before this migration).
DO $$
DECLARE
  v_rec RECORD;
  v_name text;
BEGIN
  FOR v_rec IN
    SELECT p.id, p.display_name
      FROM public.profiles p
     WHERE NOT EXISTS (
       SELECT 1 FROM public.notifications n WHERE n.user_id = p.id
     )
  LOOP
    v_name := COALESCE(NULLIF(trim(v_rec.display_name), ''), 'Farmer');

    PERFORM public.notify_user(
      v_rec.id,
      'welcome'::public.notification_kind,
      'Welcome to VFarmers, ' || v_name || '! 🌱',
      'Your account is ready. Deposit Seeds, start a farming cycle, and watch your rewards grow.',
      'profiles',
      v_rec.id
    );
  END LOOP;
END $$;
