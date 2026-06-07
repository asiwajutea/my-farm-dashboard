-- =========================================================
-- Phase 2: Wallets, Ledger, App Settings, Atomic Transfers
-- =========================================================

-- 1. Enums ------------------------------------------------------------------

CREATE TYPE public.wallet_kind AS ENUM ('primary', 'farming');

CREATE TYPE public.ledger_kind AS ENUM (
  'deposit',
  'withdrawal',
  'withdrawal_fee',
  'transfer_in',
  'transfer_out',
  'p2p_in',
  'p2p_out',
  'p2p_fee',
  'cycle_start',
  'cycle_reap_principal',
  'cycle_reap_reward',
  'booster_apply',
  'coupon_redeem',
  'referral_bonus',
  'escrow_lock',
  'escrow_release',
  'escrow_refund',
  'admin_credit',
  'admin_debit',
  'fee',
  'adjustment',
  'test_credit'
);

-- 2. Wallets table ----------------------------------------------------------

CREATE TABLE public.wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        public.wallet_kind NOT NULL,
  balance     numeric(20, 8) NOT NULL DEFAULT 0,
  locked      numeric(20, 8) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind),
  CHECK (balance >= 0),
  CHECK (locked >= 0),
  CHECK (locked <= balance)
);

CREATE INDEX wallets_user_id_idx ON public.wallets (user_id);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL    ON public.wallets TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers read their own wallets"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Ledger entries (append-only) ------------------------------------------

CREATE TABLE public.ledger_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id       uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  kind            public.ledger_kind NOT NULL,
  amount          numeric(20, 8) NOT NULL, -- signed: +credit, -debit
  balance_after   numeric(20, 8) NOT NULL,
  ref_table       text,
  ref_id          uuid,
  memo            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ledger_entries_user_created_idx
  ON public.ledger_entries (user_id, created_at DESC);
CREATE INDEX ledger_entries_wallet_created_idx
  ON public.ledger_entries (wallet_id, created_at DESC);
CREATE INDEX ledger_entries_ref_idx
  ON public.ledger_entries (ref_table, ref_id);

GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL    ON public.ledger_entries TO service_role;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers read their own ledger"
  ON public.ledger_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. App settings (singleton) ----------------------------------------------

CREATE TABLE public.app_settings (
  id                    boolean PRIMARY KEY DEFAULT true,
  seed_to_usdt          numeric(20, 8) NOT NULL DEFAULT 1.0,
  min_deposit_seed      numeric(20, 8) NOT NULL DEFAULT 10,
  min_withdraw_seed     numeric(20, 8) NOT NULL DEFAULT 10,
  withdraw_fee_pct      numeric(6, 4)  NOT NULL DEFAULT 0.02,    -- 2%
  p2p_fee_pct           numeric(6, 4)  NOT NULL DEFAULT 0.005,   -- 0.5%
  cycle_duration_days   int            NOT NULL DEFAULT 30,
  cycle_base_reward_pct numeric(6, 4)  NOT NULL DEFAULT 0.08,    -- 8% per cycle
  min_cycle_seed        numeric(20, 8) NOT NULL DEFAULT 50,
  max_cycle_seed        numeric(20, 8) NOT NULL DEFAULT 100000,
  referral_bonus_pct    numeric(6, 4)  NOT NULL DEFAULT 0.05,    -- 5%
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (id = true)
);

INSERT INTO public.app_settings (id) VALUES (true);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT ALL    ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may read app settings"
  ON public.app_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Auto-provision wallets for new users ----------------------------------
-- Extends the existing handle_new_user() to also create the two wallets.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN NEW;
END $$;

-- Backfill wallets for any users who already exist without them.
INSERT INTO public.wallets (user_id, kind)
SELECT u.id, k.kind
FROM auth.users u
CROSS JOIN (VALUES ('primary'::public.wallet_kind), ('farming'::public.wallet_kind)) AS k(kind)
ON CONFLICT (user_id, kind) DO NOTHING;

-- 6. Atomic transfer function ----------------------------------------------
-- Moves Seed between two wallets and writes paired ledger entries.
-- Use kind_out / kind_in to label both sides (e.g. 'transfer_out' / 'transfer_in',
-- 'p2p_out' / 'p2p_in', 'cycle_start' / 'cycle_start', etc.).

CREATE OR REPLACE FUNCTION public.wallet_transfer(
  p_from_wallet uuid,
  p_to_wallet   uuid,
  p_amount      numeric,
  p_kind_out    public.ledger_kind,
  p_kind_in     public.ledger_kind,
  p_memo        text DEFAULT NULL,
  p_ref_table   text DEFAULT NULL,
  p_ref_id      uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from        public.wallets%ROWTYPE;
  v_to          public.wallets%ROWTYPE;
  v_new_from    numeric(20, 8);
  v_new_to      numeric(20, 8);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;
  IF p_from_wallet = p_to_wallet THEN
    RAISE EXCEPTION 'Source and destination wallet must differ';
  END IF;

  -- Lock both rows in a deterministic order to avoid deadlocks.
  IF p_from_wallet < p_to_wallet THEN
    SELECT * INTO v_from FROM public.wallets WHERE id = p_from_wallet FOR UPDATE;
    SELECT * INTO v_to   FROM public.wallets WHERE id = p_to_wallet   FOR UPDATE;
  ELSE
    SELECT * INTO v_to   FROM public.wallets WHERE id = p_to_wallet   FOR UPDATE;
    SELECT * INTO v_from FROM public.wallets WHERE id = p_from_wallet FOR UPDATE;
  END IF;

  IF v_from.id IS NULL THEN
    RAISE EXCEPTION 'Source wallet not found';
  END IF;
  IF v_to.id IS NULL THEN
    RAISE EXCEPTION 'Destination wallet not found';
  END IF;

  IF (v_from.balance - v_from.locked) < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  v_new_from := v_from.balance - p_amount;
  v_new_to   := v_to.balance   + p_amount;

  UPDATE public.wallets SET balance = v_new_from, updated_at = now() WHERE id = v_from.id;
  UPDATE public.wallets SET balance = v_new_to,   updated_at = now() WHERE id = v_to.id;

  INSERT INTO public.ledger_entries (user_id, wallet_id, kind, amount, balance_after, ref_table, ref_id, memo)
  VALUES (v_from.user_id, v_from.id, p_kind_out, -p_amount, v_new_from, p_ref_table, p_ref_id, p_memo);

  INSERT INTO public.ledger_entries (user_id, wallet_id, kind, amount, balance_after, ref_table, ref_id, memo)
  VALUES (v_to.user_id, v_to.id, p_kind_in, p_amount, v_new_to, p_ref_table, p_ref_id, p_memo);
END $$;

-- Restrict execution: only the service role (server functions) may call it.
REVOKE ALL ON FUNCTION public.wallet_transfer(uuid, uuid, numeric, public.ledger_kind, public.ledger_kind, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_transfer(uuid, uuid, numeric, public.ledger_kind, public.ledger_kind, text, text, uuid) TO service_role;

-- 7. Single-wallet credit / debit helper -----------------------------------
-- Used for deposits, withdrawals, rewards, fees — anything that doesn't pair
-- two user wallets. Service-role only.

CREATE OR REPLACE FUNCTION public.wallet_adjust(
  p_wallet     uuid,
  p_amount     numeric,           -- signed: +credit, -debit
  p_kind       public.ledger_kind,
  p_memo       text DEFAULT NULL,
  p_ref_table  text DEFAULT NULL,
  p_ref_id     uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet  public.wallets%ROWTYPE;
  v_new     numeric(20, 8);
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be non-zero';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  v_new := v_wallet.balance + p_amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  IF (v_new - v_wallet.locked) < 0 THEN
    RAISE EXCEPTION 'Cannot reduce balance below locked amount';
  END IF;

  UPDATE public.wallets SET balance = v_new, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO public.ledger_entries (user_id, wallet_id, kind, amount, balance_after, ref_table, ref_id, memo)
  VALUES (v_wallet.user_id, v_wallet.id, p_kind, p_amount, v_new, p_ref_table, p_ref_id, p_memo);
END $$;

REVOKE ALL ON FUNCTION public.wallet_adjust(uuid, numeric, public.ledger_kind, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_adjust(uuid, numeric, public.ledger_kind, text, text, uuid) TO service_role;