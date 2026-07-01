-- =========================================================
-- Merchant System
-- Adds merchant role, profiles table, and RPCs for:
--   - merchant signup
--   - coupon redemption to merchant primary wallet
--   - merchant → farmer wallet transfer (USDT debit, Seed credit)
--   - farmer → merchant USDT transfer (P2P between primary wallets)
-- =========================================================

-- 1. Add merchant to app_role enum -----------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'merchant';

-- 2. Merchant profiles table -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_name  text NOT NULL,
  phone         text,
  city          text,
  country       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.merchant_profiles TO authenticated;
GRANT ALL ON public.merchant_profiles TO service_role;

ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant sees own profile"
  ON public.merchant_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchant updates own profile"
  ON public.merchant_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Merchant inserts own profile"
  ON public.merchant_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS merchant_profiles_updated_at ON public.merchant_profiles;
CREATE TRIGGER merchant_profiles_updated_at
  BEFORE UPDATE ON public.merchant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. has_merchant_role helper -----------------------------------------------
CREATE OR REPLACE FUNCTION public.is_merchant(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(uid, 'merchant'); $$;

GRANT EXECUTE ON FUNCTION public.is_merchant(uuid) TO authenticated, service_role;

-- 4. register_merchant RPC --------------------------------------------------
-- Called from the merchant signup page. Creates profile + assigns merchant role.
-- Also provisions a primary wallet if one doesn't exist.
CREATE OR REPLACE FUNCTION public.register_merchant(
  p_business_name text,
  p_contact_name  text,
  p_phone         text DEFAULT NULL,
  p_city          text DEFAULT NULL,
  p_country       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_business_name IS NULL OR length(trim(p_business_name)) = 0 THEN
    RAISE EXCEPTION 'Business name required';
  END IF;
  IF p_contact_name IS NULL OR length(trim(p_contact_name)) = 0 THEN
    RAISE EXCEPTION 'Contact name required';
  END IF;

  -- Upsert merchant profile
  INSERT INTO public.merchant_profiles (id, business_name, contact_name, phone, city, country)
  VALUES (v_user, trim(p_business_name), trim(p_contact_name),
          NULLIF(trim(p_phone), ''), NULLIF(trim(p_city), ''), NULLIF(trim(p_country), ''))
  ON CONFLICT (id) DO UPDATE
    SET business_name = EXCLUDED.business_name,
        contact_name  = EXCLUDED.contact_name,
        phone         = EXCLUDED.phone,
        city          = EXCLUDED.city,
        country       = EXCLUDED.country,
        updated_at    = now();

  -- Assign merchant role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user, 'merchant'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Ensure primary wallet exists (merchants share the same primary wallet kind)
  INSERT INTO public.wallets (user_id, kind)
  VALUES (v_user, 'primary')
  ON CONFLICT (user_id, kind) DO NOTHING;
END $$;

GRANT EXECUTE ON FUNCTION public.register_merchant(text, text, text, text, text) TO authenticated;

-- 5. merchant_transfer_to_farmer -------------------------------------------
-- Merchant debits their primary wallet (USDT) and credits a farmer's farming
-- wallet (Seed) at the current seed_to_usdt conversion rate.
CREATE OR REPLACE FUNCTION public.merchant_transfer_to_farmer(
  p_farmer_id   uuid,
  p_amount_usdt numeric,
  p_note        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant uuid := auth.uid();
  v_rate     numeric;
  v_seed     numeric(20,8);
  v_mw       public.wallets%ROWTYPE;  -- merchant primary wallet
  v_fw       public.wallets%ROWTYPE;  -- farmer farming wallet
  v_txn_id   uuid := gen_random_uuid();
BEGIN
  IF v_merchant IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_merchant(v_merchant) THEN RAISE EXCEPTION 'Merchant only'; END IF;
  IF p_farmer_id IS NULL OR p_farmer_id = v_merchant THEN
    RAISE EXCEPTION 'Invalid farmer';
  END IF;
  IF p_amount_usdt IS NULL OR p_amount_usdt <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Conversion rate unavailable'; END IF;
  v_seed := round(p_amount_usdt / v_rate, 8);

  SELECT * INTO v_mw FROM public.wallets WHERE user_id = v_merchant AND kind = 'primary';
  IF v_mw.id IS NULL THEN RAISE EXCEPTION 'Merchant wallet not found'; END IF;
  IF (v_mw.balance - v_mw.locked) < p_amount_usdt THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  SELECT * INTO v_fw FROM public.wallets WHERE user_id = p_farmer_id AND kind = 'farming';
  IF v_fw.id IS NULL THEN RAISE EXCEPTION 'Farmer farming wallet not found'; END IF;

  -- Debit USDT from merchant primary
  PERFORM public.wallet_adjust(v_mw.id, -p_amount_usdt, 'transfer_out'::ledger_kind,
    COALESCE(p_note, 'Merchant → Farmer transfer'), 'merchant_transfers', v_txn_id);

  -- Credit Seed to farmer farming wallet
  PERFORM public.wallet_adjust(v_fw.id, v_seed, 'transfer_in'::ledger_kind,
    COALESCE(p_note, 'Merchant top-up'), 'merchant_transfers', v_txn_id);

  RETURN v_txn_id;
END $$;

GRANT EXECUTE ON FUNCTION public.merchant_transfer_to_farmer(uuid, numeric, text) TO authenticated;

-- 6. Merchant coupon redemption ---------------------------------------------
-- Reuses the existing redeem_coupon function which credits the caller's
-- primary wallet (USDT for USDT coupons). No change needed — merchants
-- use the same primary wallet and the same redeem_coupon RPC.

-- 7. Merchant receives USDT from a farmer -----------------------------------
-- Farmers can send USDT from their primary wallet to a merchant's primary wallet.
-- This reuses the existing p2p_send RPC (both are primary wallets in USDT).
-- No new RPC required.

-- 8. Admin can list merchant profiles ---------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_merchants()
RETURNS TABLE (
  id           uuid,
  business_name text,
  contact_name  text,
  phone         text,
  city          text,
  country       text,
  created_at    timestamptz,
  primary_balance numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN QUERY
    SELECT mp.id, mp.business_name, mp.contact_name, mp.phone, mp.city, mp.country,
           mp.created_at,
           COALESCE(w.balance, 0)::numeric AS primary_balance
    FROM public.merchant_profiles mp
    LEFT JOIN public.wallets w ON w.user_id = mp.id AND w.kind = 'primary'
    ORDER BY mp.created_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_merchants() TO authenticated, service_role;
