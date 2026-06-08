
-- ============ Auto-assign 'farmer' role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_referral_code()
  );

  INSERT INTO public.wallets (user_id, kind) VALUES
    (NEW.id, 'primary'),
    (NEW.id, 'farming')
  ON CONFLICT (user_id, kind) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'farmer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $function$;

-- Backfill existing users with farmer role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'farmer'::public.app_role
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

-- Seed admin
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'dakintuyi@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- ============ P2P transfers ============
DO $$ BEGIN
  CREATE TYPE public.transfer_status AS ENUM ('completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.p2p_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(20,8) NOT NULL CHECK (amount > 0),
  fee numeric(20,8) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  note text,
  status public.transfer_status NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p2p_transfers_sender_idx ON public.p2p_transfers (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS p2p_transfers_receiver_idx ON public.p2p_transfers (receiver_id, created_at DESC);

GRANT SELECT ON public.p2p_transfers TO authenticated;
GRANT ALL ON public.p2p_transfers TO service_role;
ALTER TABLE public.p2p_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view own transfers" ON public.p2p_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR public.has_role(auth.uid(),'admin'));

-- ============ Coupons ============
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric(20,8) NOT NULL CHECK (amount > 0),
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  used_redemptions integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER coupons_set_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active coupons" ON public.coupons
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage coupons" ON public.coupons
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ Coupon redemptions ============
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(20,8) NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON public.coupon_redemptions (user_id, redeemed_at DESC);

GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ RPC: p2p_send ============
CREATE OR REPLACE FUNCTION public.p2p_send(p_receiver_id uuid, p_amount numeric, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender   uuid := auth.uid();
  v_settings public.app_settings%ROWTYPE;
  v_fee_pct  numeric := 0;
  v_fee      numeric(20,8);
  v_total    numeric(20,8);
  v_sw       public.wallets%ROWTYPE;
  v_rw       public.wallets%ROWTYPE;
  v_id       uuid;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_receiver_id IS NULL THEN RAISE EXCEPTION 'Receiver required'; END IF;
  IF p_receiver_id = v_sender THEN RAISE EXCEPTION 'Cannot send to yourself'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NOT NULL THEN
    v_fee_pct := COALESCE(v_settings.p2p_fee_pct, 0);
  END IF;
  v_fee := round(p_amount * v_fee_pct / 100.0, 8);
  v_total := p_amount + v_fee;

  SELECT * INTO v_sw FROM public.wallets WHERE user_id = v_sender AND kind = 'primary';
  IF v_sw.id IS NULL THEN RAISE EXCEPTION 'Sender primary wallet not found'; END IF;
  SELECT * INTO v_rw FROM public.wallets WHERE user_id = p_receiver_id AND kind = 'primary';
  IF v_rw.id IS NULL THEN RAISE EXCEPTION 'Receiver primary wallet not found'; END IF;

  IF (v_sw.balance - v_sw.locked) < v_total THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.p2p_transfers (sender_id, receiver_id, amount, fee, note)
  VALUES (v_sender, p_receiver_id, p_amount, v_fee, p_note)
  RETURNING id INTO v_id;

  PERFORM public.wallet_transfer(
    v_sw.id, v_rw.id, p_amount,
    'p2p_out'::ledger_kind, 'p2p_in'::ledger_kind,
    COALESCE(p_note,'P2P transfer'), 'p2p_transfers', v_id
  );
  IF v_fee > 0 THEN
    PERFORM public.wallet_adjust(v_sw.id, -v_fee, 'p2p_fee'::ledger_kind, 'P2P fee', 'p2p_transfers', v_id);
  END IF;

  RETURN v_id;
END $$;

-- ============ RPC: redeem_coupon ============
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_coupon public.coupons%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_red_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RAISE EXCEPTION 'Code required'; END IF;

  SELECT * INTO v_coupon FROM public.coupons WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'Invalid coupon code'; END IF;
  IF NOT v_coupon.active THEN RAISE EXCEPTION 'Coupon is inactive'; END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Coupon has expired';
  END IF;
  IF v_coupon.used_redemptions >= v_coupon.max_redemptions THEN
    RAISE EXCEPTION 'Coupon fully redeemed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Already redeemed';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, amount)
  VALUES (v_coupon.id, v_user, v_coupon.amount)
  RETURNING id INTO v_red_id;

  UPDATE public.coupons SET used_redemptions = used_redemptions + 1 WHERE id = v_coupon.id;

  PERFORM public.wallet_adjust(
    v_wallet.id, v_coupon.amount,
    'coupon_redeem'::ledger_kind,
    'Coupon ' || v_coupon.code, 'coupons', v_coupon.id
  );

  RETURN v_red_id;
END $$;
