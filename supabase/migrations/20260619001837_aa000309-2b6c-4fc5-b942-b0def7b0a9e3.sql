
-- Enum extensions ----------------------------------------------------------
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'pv_earned';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'transfer_to_primary';
ALTER TYPE public.ledger_kind ADD VALUE IF NOT EXISTS 'farming_to_primary';

COMMIT;
BEGIN;

-- PV activities catalog ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pv_activities (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  self_points numeric(20,4) NOT NULL DEFAULT 0,
  g1_points   numeric(20,4) NOT NULL DEFAULT 0,
  g2_points   numeric(20,4) NOT NULL DEFAULT 0,
  g3_points   numeric(20,4) NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pv_activities TO authenticated, anon;
GRANT ALL ON public.pv_activities TO service_role;
ALTER TABLE public.pv_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read pv activities" ON public.pv_activities;
CREATE POLICY "Anyone can read pv activities" ON public.pv_activities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage pv activities" ON public.pv_activities;
CREATE POLICY "Admins manage pv activities" ON public.pv_activities FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS pv_activities_updated_at ON public.pv_activities;
CREATE TRIGGER pv_activities_updated_at BEFORE UPDATE ON public.pv_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default activities
INSERT INTO public.pv_activities (code, label, description, self_points, g1_points, g2_points, g3_points)
VALUES
  ('signup',            'New signup',           'Account created',                       10, 5, 2, 1),
  ('email_verified',    'Email verified',       'Confirmed email address',                5, 0, 0, 0),
  ('kyc_approved',      'KYC verified',         'Identity verification approved',        20, 5, 2, 1),
  ('cycle_started',     'Farming cycle started','New cycle opened',                       5, 2, 1, 1),
  ('cycle_reaped',      'Farming cycle reaped', 'Cycle harvested',                       10, 3, 2, 1),
  ('coupon_redeemed',   'Coupon redeemed',      'Coupon successfully redeemed',           5, 1, 0, 0),
  ('p2p_sent',          'P2P transfer sent',    'Sent funds to another farmer',           2, 0, 0, 0),
  ('deposit_approved',  'Deposit approved',     'Deposit request approved',              10, 3, 1, 1),
  ('withdraw_approved', 'Withdrawal approved',  'Withdrawal request approved',            5, 0, 0, 0),
  ('maintenance_paid',  'Maintenance paid',     'Monthly maintenance fee settled',        5, 1, 0, 0),
  ('farming_deposit',   'Funded farming wallet','Moved funds into farming wallet',        3, 1, 0, 0),
  ('farming_withdraw',  'Farming → Primary',    'Converted seeds back to USDT',           1, 0, 0, 0)
ON CONFLICT (code) DO NOTHING;

-- PV ledger ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pv_ledger (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_code  text NOT NULL REFERENCES public.pv_activities(code) ON DELETE CASCADE,
  points         numeric(20,4) NOT NULL,
  generation     int NOT NULL DEFAULT 0 CHECK (generation BETWEEN 0 AND 3),
  source_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ref_table      text,
  ref_id         uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pv_ledger_user_idx ON public.pv_ledger(user_id, created_at DESC);
GRANT SELECT ON public.pv_ledger TO authenticated;
GRANT ALL ON public.pv_ledger TO service_role;
ALTER TABLE public.pv_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own pv ledger" ON public.pv_ledger;
CREATE POLICY "Users see own pv ledger" ON public.pv_ledger FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

-- award_pv: credits self + 3 uplines, sends notifications ------------------
CREATE OR REPLACE FUNCTION public.award_pv(
  p_user uuid,
  p_activity text,
  p_ref_table text DEFAULT NULL,
  p_ref_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_act public.pv_activities%ROWTYPE;
  v_up RECORD;
  v_pts numeric(20,4);
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  SELECT * INTO v_act FROM public.pv_activities WHERE code = p_activity AND active = true;
  IF v_act.code IS NULL THEN RETURN; END IF;

  -- Self award
  IF v_act.self_points > 0 THEN
    INSERT INTO public.pv_ledger(user_id, activity_code, points, generation, source_user_id, ref_table, ref_id)
    VALUES (p_user, v_act.code, v_act.self_points, 0, p_user, p_ref_table, p_ref_id);
    PERFORM public.notify_user(p_user, 'pv_earned'::notification_kind,
      'Points earned',
      '+' || trim(trailing '.' from trim(trailing '0' from v_act.self_points::text)) || ' PV — ' || v_act.label,
      p_ref_table, p_ref_id);
  END IF;

  -- Upline awards (3 generations)
  FOR v_up IN SELECT user_id, generation FROM public.get_uplines(p_user) LOOP
    v_pts := CASE v_up.generation
      WHEN 1 THEN v_act.g1_points
      WHEN 2 THEN v_act.g2_points
      WHEN 3 THEN v_act.g3_points
      ELSE 0 END;
    IF v_pts > 0 THEN
      INSERT INTO public.pv_ledger(user_id, activity_code, points, generation, source_user_id, ref_table, ref_id)
      VALUES (v_up.user_id, v_act.code, v_pts, v_up.generation, p_user, p_ref_table, p_ref_id);
      PERFORM public.notify_user(v_up.user_id, 'pv_earned'::notification_kind,
        'Points earned',
        '+' || trim(trailing '.' from trim(trailing '0' from v_pts::text)) || ' PV — Gen ' || v_up.generation || ' ' || v_act.label,
        p_ref_table, p_ref_id);
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.award_pv(uuid, text, text, uuid) TO authenticated, service_role;

-- Admin RPCs ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_upsert_pv_activity(
  p_code text,
  p_label text,
  p_description text,
  p_self numeric,
  p_g1 numeric,
  p_g2 numeric,
  p_g3 numeric,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Admin only'; END IF;
  INSERT INTO public.pv_activities(code, label, description, self_points, g1_points, g2_points, g3_points, active)
  VALUES (lower(trim(p_code)), trim(p_label), NULLIF(trim(p_description),''),
          COALESCE(p_self,0), COALESCE(p_g1,0), COALESCE(p_g2,0), COALESCE(p_g3,0), COALESCE(p_active,true))
  ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    self_points = EXCLUDED.self_points,
    g1_points = EXCLUDED.g1_points,
    g2_points = EXCLUDED.g2_points,
    g3_points = EXCLUDED.g3_points,
    active = EXCLUDED.active,
    updated_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_pv_activity(text,text,text,numeric,numeric,numeric,numeric,boolean) TO authenticated;

-- Trigger wrappers ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_pv_profile_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN PERFORM public.award_pv(NEW.id, 'signup', 'profiles', NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS pv_profile_insert ON public.profiles;
CREATE TRIGGER pv_profile_insert AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_profile_insert();

CREATE OR REPLACE FUNCTION public.tg_pv_cycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.award_pv(NEW.user_id, 'cycle_started', 'cycles', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'reaped' AND OLD.status IS DISTINCT FROM 'reaped' THEN
    PERFORM public.award_pv(NEW.user_id, 'cycle_reaped', 'cycles', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pv_cycle ON public.cycles;
CREATE TRIGGER pv_cycle AFTER INSERT OR UPDATE ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_cycle();

CREATE OR REPLACE FUNCTION public.tg_pv_p2p() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.award_pv(NEW.sender_id, 'p2p_sent', 'p2p_transfers', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pv_p2p ON public.p2p_transfers;
CREATE TRIGGER pv_p2p AFTER INSERT OR UPDATE ON public.p2p_transfers
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_p2p();

CREATE OR REPLACE FUNCTION public.tg_pv_coupon() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN PERFORM public.award_pv(NEW.user_id, 'coupon_redeemed', 'coupon_redemptions', NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS pv_coupon ON public.coupon_redemptions;
CREATE TRIGGER pv_coupon AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_coupon();

CREATE OR REPLACE FUNCTION public.tg_pv_deposit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.award_pv(NEW.user_id, 'deposit_approved', 'deposit_requests', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pv_deposit ON public.deposit_requests;
CREATE TRIGGER pv_deposit AFTER UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_deposit();

CREATE OR REPLACE FUNCTION public.tg_pv_withdrawal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.award_pv(NEW.user_id, 'withdraw_approved', 'withdrawal_requests', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pv_withdrawal ON public.withdrawal_requests;
CREATE TRIGGER pv_withdrawal AFTER UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_withdrawal();

CREATE OR REPLACE FUNCTION public.tg_pv_kyc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN
    PERFORM public.award_pv(NEW.user_id, 'kyc_approved', 'kyc_documents', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pv_kyc ON public.kyc_documents;
CREATE TRIGGER pv_kyc AFTER UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_kyc();

CREATE OR REPLACE FUNCTION public.tg_pv_maintenance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    PERFORM public.award_pv(NEW.user_id, 'maintenance_paid', 'maintenance_fees', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pv_maintenance ON public.maintenance_fees;
CREATE TRIGGER pv_maintenance AFTER UPDATE ON public.maintenance_fees
  FOR EACH ROW EXECUTE FUNCTION public.tg_pv_maintenance();

-- Extend handle_email_verified to award PV
CREATE OR REPLACE FUNCTION public.handle_email_verified()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    PERFORM public.notify_user(NEW.id, 'email_verified'::notification_kind,
      'Email verified',
      'Your email address has been confirmed.');
    PERFORM public.award_pv(NEW.id, 'email_verified', 'auth.users', NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- Farming → Primary RPC ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.farming_to_primary(p_amount_seed numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rate numeric;
  v_usdt numeric(20,2);
  v_pw   public.wallets%ROWTYPE;
  v_fw   public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount_seed IS NULL OR p_amount_seed <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Conversion rate unavailable'; END IF;
  v_usdt := round(p_amount_seed * v_rate, 2);
  IF v_usdt <= 0 THEN RAISE EXCEPTION 'Amount too small to convert'; END IF;

  SELECT * INTO v_fw FROM public.wallets WHERE user_id = v_user AND kind = 'farming';
  IF v_fw.id IS NULL THEN RAISE EXCEPTION 'Farming wallet not found'; END IF;
  IF (v_fw.balance - v_fw.locked) < p_amount_seed THEN RAISE EXCEPTION 'Insufficient farming balance'; END IF;

  SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  PERFORM public.wallet_adjust(v_fw.id, -p_amount_seed, 'transfer_out'::ledger_kind,
    'Convert ' || p_amount_seed::text || ' Seed → ' || v_usdt::text || ' USDT', NULL, NULL);
  PERFORM public.wallet_adjust(v_pw.id, v_usdt, 'farming_to_primary'::ledger_kind,
    'Farming → Primary (' || p_amount_seed::text || ' Seed)', NULL, NULL);

  PERFORM public.notify_user(v_user, 'transfer_to_primary'::notification_kind,
    'Farming → Primary',
    'Converted ' || p_amount_seed::text || ' Seed to ' || v_usdt::text || ' USDT.');

  PERFORM public.award_pv(v_user, 'farming_withdraw', 'wallets', v_fw.id);
END $$;
GRANT EXECUTE ON FUNCTION public.farming_to_primary(numeric) TO authenticated;

-- User passcodes -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_passcodes (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  passcode_hash  text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_passcodes TO service_role;
-- No grants to authenticated/anon: only service role (server admin client) accesses this.
ALTER TABLE public.user_passcodes ENABLE ROW LEVEL SECURITY;
-- No policies = no client access at all. Server uses service_role.

DROP TRIGGER IF EXISTS user_passcodes_updated_at ON public.user_passcodes;
CREATE TRIGGER user_passcodes_updated_at BEFORE UPDATE ON public.user_passcodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_passcode()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_passcodes WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.has_passcode() TO authenticated;

COMMIT;
