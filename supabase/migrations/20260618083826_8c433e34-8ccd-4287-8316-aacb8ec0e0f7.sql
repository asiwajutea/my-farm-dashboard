
-- =========================================================
-- rate_history table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_to_usdt numeric(20,8) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_history_recorded_at_idx
  ON public.rate_history (recorded_at DESC);

GRANT SELECT ON public.rate_history TO anon, authenticated;
GRANT ALL ON public.rate_history TO service_role;

ALTER TABLE public.rate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_history readable to all" ON public.rate_history;
CREATE POLICY "rate_history readable to all"
  ON public.rate_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed initial point from current app_settings (if any)
INSERT INTO public.rate_history (seed_to_usdt, recorded_at)
SELECT seed_to_usdt, now() FROM public.app_settings WHERE id = true
ON CONFLICT DO NOTHING;

-- Trigger: insert into rate_history when seed_to_usdt changes
CREATE OR REPLACE FUNCTION public.log_rate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seed_to_usdt IS DISTINCT FROM OLD.seed_to_usdt AND NEW.seed_to_usdt IS NOT NULL THEN
    INSERT INTO public.rate_history (seed_to_usdt) VALUES (NEW.seed_to_usdt);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS app_settings_log_rate ON public.app_settings;
CREATE TRIGGER app_settings_log_rate
  AFTER UPDATE OF seed_to_usdt ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_rate_change();

-- =========================================================
-- Notification triggers
-- =========================================================

-- Welcome notification: extend handle_new_user (preserve existing behaviour)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code text;
  v_ref_id   uuid;
  v_new_name text;
BEGIN
  v_ref_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF length(v_ref_code) > 0 THEN
    SELECT id INTO v_ref_id FROM public.profiles WHERE referral_code = v_ref_code;
    IF v_ref_id = NEW.id THEN v_ref_id := NULL; END IF;
  END IF;

  v_new_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code, referred_by)
  VALUES (
    NEW.id,
    v_new_name,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), '/avatars/01.svg'),
    public.generate_referral_code(),
    v_ref_id
  );

  INSERT INTO public.wallets (user_id, kind) VALUES (NEW.id, 'primary'), (NEW.id, 'farming')
  ON CONFLICT (user_id, kind) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farmer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Welcome notification
  PERFORM public.notify_user(NEW.id, 'welcome'::notification_kind,
    'Welcome to VFarmers 🌱',
    'Your account is ready. Fund your wallet and start your first farming cycle.');

  -- Affiliate signup notification for the upline
  IF v_ref_id IS NOT NULL THEN
    PERFORM public.notify_user(v_ref_id, 'affiliate_signup'::notification_kind,
      'New downline joined',
      v_new_name || ' joined using your referral link.',
      'profiles', NEW.id);
  END IF;

  RETURN NEW;
END $$;

-- Email verified: trigger on auth.users.email_confirmed_at change
CREATE OR REPLACE FUNCTION public.handle_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    PERFORM public.notify_user(NEW.id, 'email_verified'::notification_kind,
      'Email verified',
      'Your email address has been confirmed.');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_verified();

-- P2P: notify sender + receiver
CREATE OR REPLACE FUNCTION public.notify_p2p()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_receiver_name text;
BEGIN
  SELECT display_name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT display_name INTO v_receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  PERFORM public.notify_user(NEW.receiver_id, 'transfer_received'::notification_kind,
    'You received ' || NEW.amount::text || ' Seed',
    'From ' || COALESCE(v_sender_name,'a farmer') || COALESCE(' — '||NEW.note,''),
    'p2p_transfers', NEW.id);
  PERFORM public.notify_user(NEW.sender_id, 'p2p_sent'::notification_kind,
    'Sent ' || NEW.amount::text || ' Seed',
    'To ' || COALESCE(v_receiver_name,'a farmer'),
    'p2p_transfers', NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS p2p_transfers_notify ON public.p2p_transfers;
CREATE TRIGGER p2p_transfers_notify
  AFTER INSERT ON public.p2p_transfers
  FOR EACH ROW EXECUTE FUNCTION public.notify_p2p();

-- Cycle started
CREATE OR REPLACE FUNCTION public.notify_cycle_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id, 'cycle_started'::notification_kind,
    'Farming cycle started',
    'Locked ' || NEW.amount::text || ' Seed into a cycle.',
    'cycles', NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cycles_notify_started ON public.cycles;
CREATE TRIGGER cycles_notify_started
  AFTER INSERT ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.notify_cycle_started();

-- Coupon redeemed
CREATE OR REPLACE FUNCTION public.notify_coupon_redeemed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id, 'coupon_redeemed'::notification_kind,
    'Coupon redeemed',
    'Bonus has been credited to your wallet.',
    'coupon_redemptions', NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coupon_redemptions_notify ON public.coupon_redemptions;
CREATE TRIGGER coupon_redemptions_notify
  AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_coupon_redeemed();

-- KYC submitted
CREATE OR REPLACE FUNCTION public.notify_kyc_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id, 'kyc_submitted'::notification_kind,
    'KYC submitted',
    'We have received your verification documents and will review them shortly.',
    'kyc_documents', NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kyc_documents_notify_submitted ON public.kyc_documents;
CREATE TRIGGER kyc_documents_notify_submitted
  AFTER INSERT ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_submitted();

-- Maintenance fee paid
CREATE OR REPLACE FUNCTION public.notify_maintenance_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD.paid_at IS DISTINCT FROM NEW.paid_at) THEN
    PERFORM public.notify_user(NEW.user_id, 'maintenance_paid'::notification_kind,
      'Maintenance fee paid',
      'Thank you. Your account remains active.',
      'maintenance_fees', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS maintenance_fees_notify_paid ON public.maintenance_fees;
CREATE TRIGGER maintenance_fees_notify_paid
  AFTER UPDATE OF paid_at ON public.maintenance_fees
  FOR EACH ROW EXECUTE FUNCTION public.notify_maintenance_paid();
