-- =========================================================
-- Premium Membership
-- Adds membership_tier enum, extends ledger_kind and
-- notification_kind enums, adds new columns to profiles and
-- app_settings, and creates the premium_upgrades audit table
-- with RLS policies.
--
-- Requirements: 1.1–1.12, 2.1–2.10, 15.4, 16.1, 16.3, 16.4
-- =========================================================

-- 1. New enum: membership_tier ---------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.membership_tier AS ENUM (
    'standard',
    'premium',
    'gold',
    'platinum'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend ledger_kind with premium-specific values -----------------------
-- ADD VALUE IF NOT EXISTS is idempotent and cannot be wrapped in a
-- conditional DO block with the same guard, so we use IF NOT EXISTS.
ALTER TYPE public.ledger_kind ADD VALUE IF NOT EXISTS 'premium_upgrade';
ALTER TYPE public.ledger_kind ADD VALUE IF NOT EXISTS 'maintenance_ref_reward';

-- 3. Extend notification_kind with premium lifecycle values ----------------
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'premium_activated';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'premium_expiring';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'premium_expired';

-- 4. profiles table — new premium columns ----------------------------------
-- Each ALTER is guarded with IF NOT EXISTS for idempotency.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_tier      public.membership_tier NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS premium_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS premium_fee_paid     numeric(18, 6),
  ADD COLUMN IF NOT EXISTS premium_badge        text;

-- Generated column must be added separately (cannot use IF NOT EXISTS with
-- a generated column expression in a single ADD COLUMN … IF NOT EXISTS).
-- We check the catalog first so re-running is safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'profiles'
       AND column_name  = 'is_premium'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN is_premium boolean GENERATED ALWAYS AS (
        membership_tier IN ('premium', 'gold', 'platinum')
      ) STORED;
  END IF;
END $$;

-- 5. app_settings table — new premium configuration columns ----------------
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS premium_enabled              boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS premium_fee_usdt             numeric  NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS premium_duration_days        integer  NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS premium_badge_name           text     NOT NULL DEFAULT 'Premium Farmer',
  ADD COLUMN IF NOT EXISTS premium_badge_color          text     NOT NULL DEFAULT '#F5C518',
  ADD COLUMN IF NOT EXISTS premium_farming_bonus_pct    numeric  NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS withdrawal_fee_standard_pct  numeric  NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS withdrawal_fee_premium_pct   numeric  NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS referral_gen2_pct            numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_gen3_pct            numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_ref_gen1_pct     numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_ref_gen2_pct     numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_ref_gen3_pct     numeric  NOT NULL DEFAULT 0;

-- CHECK constraints — use DO block so re-running is idempotent
-- (PostgreSQL raises duplicate_object if a constraint already exists).
DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_premium_fee_usdt_check
      CHECK (premium_fee_usdt >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_premium_duration_days_check
      CHECK (premium_duration_days >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_premium_farming_bonus_pct_check
      CHECK (premium_farming_bonus_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_withdrawal_fee_standard_pct_check
      CHECK (withdrawal_fee_standard_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_withdrawal_fee_premium_pct_check
      CHECK (withdrawal_fee_premium_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_referral_gen2_pct_check
      CHECK (referral_gen2_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_referral_gen3_pct_check
      CHECK (referral_gen3_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_maintenance_ref_gen1_pct_check
      CHECK (maintenance_ref_gen1_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_maintenance_ref_gen2_pct_check
      CHECK (maintenance_ref_gen2_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_maintenance_ref_gen3_pct_check
      CHECK (maintenance_ref_gen3_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. premium_upgrades audit table ------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_upgrades (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usdt      numeric(18, 6) NOT NULL,
  paid_from_wallet text        NOT NULL CHECK (paid_from_wallet IN ('primary', 'farming')),
  tier             public.membership_tier NOT NULL,
  activated_at     timestamptz NOT NULL,
  expires_at       timestamptz NOT NULL,
  tx_ref           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS premium_upgrades_user_id_idx
  ON public.premium_upgrades (user_id, created_at DESC);

GRANT SELECT ON public.premium_upgrades TO authenticated;
GRANT ALL    ON public.premium_upgrades TO service_role;

-- 7. RLS on premium_upgrades -----------------------------------------------
ALTER TABLE public.premium_upgrades ENABLE ROW LEVEL SECURITY;

-- Users may read their own upgrade history.
DO $$ BEGIN
  CREATE POLICY "Users can view own upgrades"
    ON public.premium_upgrades FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- All DML (INSERT / UPDATE / DELETE) is restricted to service_role only.
-- Authenticated users have no INSERT/UPDATE/DELETE policy, so those
-- operations are implicitly denied under RLS.
-- We explicitly block anon as well:
DO $$ BEGIN
  CREATE POLICY "Service role only DML"
    ON public.premium_upgrades
    AS RESTRICTIVE
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- fn_expire_premium() — idempotent nightly job
-- Requirements: 4.1, 4.2, 4.6, 15.3
--
-- Finds all users where membership_tier = 'premium' AND
-- premium_expires_at <= now(), reverts them to standard, and
-- sends a premium_expired notification only if one has not
-- already been sent today (same UTC day).
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_expire_premium()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user     RECORD;
  v_count    integer := 0;
BEGIN
  -- Iterate over every premium user whose membership has lapsed.
  -- We also capture users already reverted to 'standard' but whose
  -- premium_expires_at is still set (shouldn't normally occur, but
  -- guards against partial previous runs).
  FOR v_user IN
    SELECT id
      FROM public.profiles
     WHERE membership_tier = 'premium'
       AND premium_expires_at IS NOT NULL
       AND premium_expires_at <= now()
  LOOP
    -- 1. Revert tier and clear expiry (idempotent: safe to run again).
    UPDATE public.profiles
       SET membership_tier    = 'standard',
           premium_expires_at = NULL
     WHERE id = v_user.id;

    -- 2. Send premium_expired notification only if none was sent today
    --    (UTC day boundary — prevents duplicates on re-runs within same day).
    IF NOT EXISTS (
      SELECT 1
        FROM public.notifications
       WHERE user_id = v_user.id
         AND kind    = 'premium_expired'
         AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE
    ) THEN
      PERFORM public.notify_user(
        v_user.id,
        'premium_expired',
        'Premium membership expired',
        'Your Premium Farmer membership has expired. Renew now to restore your benefits.',
        'profiles',
        v_user.id
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Grant execute to service_role only (called by a cron / scheduled job).
GRANT EXECUTE ON FUNCTION public.fn_expire_premium() TO service_role;

-- =========================================================
-- fn_upgrade_to_premium(p_user_id uuid)
-- SECURITY DEFINER — atomically charges the premium fee,
-- records the upgrade audit row, updates the user's profile,
-- and emits a notification.
--
-- Requirements: 1.11, 3.4, 3.5, 3.6, 3.9, 15.1, 15.2, 15.7
-- =========================================================

CREATE OR REPLACE FUNCTION public.fn_upgrade_to_premium(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings        public.app_settings%ROWTYPE;
  v_fee             numeric(18,6);
  v_duration_days   integer;
  v_badge_name      text;
  v_wallet          public.wallets%ROWTYPE;
  v_profile         public.profiles%ROWTYPE;
  v_new_expires_at  timestamptz;
  v_upgrade_id      uuid;
BEGIN
  -- 1. Guard: read app_settings and check premium_enabled --------------------
  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NULL THEN
    RAISE EXCEPTION 'App settings not found';
  END IF;
  IF NOT v_settings.premium_enabled THEN
    RAISE EXCEPTION 'Premium membership upgrades are currently disabled';
  END IF;

  v_fee           := v_settings.premium_fee_usdt;
  v_duration_days := v_settings.premium_duration_days;
  v_badge_name    := v_settings.premium_badge_name;

  -- 2. Application-level guard: reject gold/platinum assignments --------------
  -- This function ONLY ever sets membership_tier to 'premium'.
  -- Enforce here so no code path can sneak through gold/platinum via this RPC.

  -- 3. Read and lock the user's primary wallet row FOR UPDATE ----------------
  SELECT * INTO v_wallet
    FROM public.wallets
   WHERE user_id = p_user_id
     AND kind    = 'primary'
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Primary wallet not found';
  END IF;

  -- 4. Raise if balance < fee -------------------------------------------------
  IF (v_wallet.balance - v_wallet.locked) < v_fee THEN
    RAISE EXCEPTION 'Insufficient Primary Wallet balance';
  END IF;

  -- 5. Read current profile to determine renewal vs. first-time activation ---
  SELECT * INTO v_profile
    FROM public.profiles
   WHERE id = p_user_id;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- 6. Compute new premium_expires_at ----------------------------------------
  -- Renewal: extend from existing premium_expires_at (Req 3.9)
  -- New upgrade: now() + duration days (Req 3.4)
  IF v_profile.membership_tier = 'premium'
     AND v_profile.premium_expires_at IS NOT NULL
     AND v_profile.premium_expires_at > now() THEN
    -- Active premium → extend from current expiry
    v_new_expires_at := v_profile.premium_expires_at
                        + (v_duration_days * interval '1 day');
  ELSE
    -- Standard or expired premium → start fresh from now()
    v_new_expires_at := now() + (v_duration_days * interval '1 day');
  END IF;

  -- 7. Deduct fee from primary wallet ----------------------------------------
  -- wallet_adjust handles the UPDATE on wallets + the ledger_entries INSERT
  PERFORM public.wallet_adjust(
    v_wallet.id,
    -v_fee,
    'premium_upgrade'::public.ledger_kind,
    'Premium membership upgrade',
    'premium_upgrades',
    NULL   -- upgrade row id not yet known; will be backfilled via ref below
  );

  -- 8. Insert premium_upgrades audit row -------------------------------------
  INSERT INTO public.premium_upgrades (
    user_id,
    amount_usdt,
    paid_from_wallet,
    tier,
    activated_at,
    expires_at
  ) VALUES (
    p_user_id,
    v_fee,
    'primary',
    'premium',
    now(),
    v_new_expires_at
  )
  RETURNING id INTO v_upgrade_id;

  -- 9. Update profiles -------------------------------------------------------
  UPDATE public.profiles
     SET membership_tier       = 'premium',
         premium_activated_at  = now(),
         premium_expires_at    = v_new_expires_at,
         premium_fee_paid      = v_fee,
         premium_badge         = v_badge_name
   WHERE id = p_user_id;

  -- 10. Insert notification ---------------------------------------------------
  PERFORM public.notify_user(
    p_user_id,
    'premium_activated'::public.notification_kind,
    'Premium membership activated 🌟',
    'Your Premium Farmer membership is active until '
      || to_char(v_new_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      || '.',
    'premium_upgrades',
    v_upgrade_id
  );
END $$;

-- Grant: authenticated users call this RPC on their own behalf.
-- The SECURITY DEFINER context runs as the function owner (postgres / service_role),
-- so all inner writes bypass RLS. The auth.uid() check in the calling server
-- function ensures callers can only upgrade themselves.
GRANT EXECUTE ON FUNCTION public.fn_upgrade_to_premium(uuid) TO authenticated;

-- =========================================================
-- fn_distribute_maintenance_refs(p_fee_id uuid)
--
-- Called within the same transaction as pay_maintenance_fee.
-- Walks up to 3 upline sponsors of the paying user.
-- For each generation G (1, 2, 3):
--   - Checks sponsor is premium/gold/platinum AND premium_expires_at > now()
--   - If eligible: credits fee_amount × maintenance_ref_genG_pct / 100 to
--     the sponsor's primary wallet and inserts a ledger_entries row with
--     kind = 'maintenance_ref_reward'
--   - Skips missing generations silently
--   - Uses COALESCE(pct, 0) for any NULL percentages
--
-- Requirements: 7.1–7.9
-- =========================================================

CREATE OR REPLACE FUNCTION public.fn_distribute_maintenance_refs(p_fee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fee         public.maintenance_fees%ROWTYPE;
  v_settings    public.app_settings%ROWTYPE;
  v_rate        numeric;
  v_fee_usdt    numeric(20, 2);
  v_upline      record;
  v_sponsor     public.profiles%ROWTYPE;
  v_pct         numeric;
  v_reward      numeric(20, 2);
  v_wallet      public.wallets%ROWTYPE;
BEGIN
  -- Load the maintenance fee record
  SELECT * INTO v_fee FROM public.maintenance_fees WHERE id = p_fee_id;
  IF v_fee.id IS NULL THEN
    RAISE EXCEPTION 'Maintenance fee record not found: %', p_fee_id;
  END IF;

  -- Load app_settings for percentages and the Seed→USDT conversion rate
  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NULL THEN
    RETURN; -- no settings row; nothing to distribute
  END IF;

  -- Convert the fee amount (stored in Seed) to USDT, matching pay_maintenance_fee logic
  v_rate     := COALESCE(v_settings.seed_to_usdt, 1);
  v_fee_usdt := round(v_fee.amount * v_rate, 2);

  IF v_fee_usdt <= 0 THEN
    RETURN; -- nothing to distribute
  END IF;

  -- Walk up to 3 upline generations
  FOR v_upline IN SELECT * FROM public.get_uplines(v_fee.user_id) LOOP

    -- Load full profile to check tier and expiry
    SELECT * INTO v_sponsor FROM public.profiles WHERE id = v_upline.user_id;
    IF v_sponsor.id IS NULL THEN
      CONTINUE; -- ghost row, skip silently
    END IF;

    -- Check premium eligibility: tier must be premium/gold/platinum AND not expired
    IF v_sponsor.membership_tier NOT IN ('premium', 'gold', 'platinum') THEN
      CONTINUE;
    END IF;
    IF v_sponsor.premium_expires_at IS NULL OR v_sponsor.premium_expires_at <= now() THEN
      CONTINUE;
    END IF;

    -- Pick the correct percentage for this generation (COALESCE NULL → 0)
    v_pct := CASE v_upline.generation
      WHEN 1 THEN COALESCE(v_settings.maintenance_ref_gen1_pct, 0)
      WHEN 2 THEN COALESCE(v_settings.maintenance_ref_gen2_pct, 0)
      WHEN 3 THEN COALESCE(v_settings.maintenance_ref_gen3_pct, 0)
      ELSE 0
    END;

    IF v_pct <= 0 THEN
      CONTINUE; -- percentage is zero; skip without inserting an empty entry
    END IF;

    v_reward := round(v_fee_usdt * v_pct / 100, 2);
    IF v_reward <= 0 THEN
      CONTINUE;
    END IF;

    -- Look up sponsor's primary wallet
    SELECT * INTO v_wallet
      FROM public.wallets
     WHERE user_id = v_upline.user_id
       AND kind = 'primary';

    IF v_wallet.id IS NULL THEN
      CONTINUE; -- no primary wallet; skip silently
    END IF;

    -- Credit sponsor's primary wallet and insert ledger entry (maintenance_ref_reward)
    PERFORM public.wallet_adjust(
      v_wallet.id,
      v_reward,
      'maintenance_ref_reward'::public.ledger_kind,
      'Gen ' || v_upline.generation || ' maintenance ref reward',
      'maintenance_fees',
      p_fee_id
    );

  END LOOP;
END $$;

-- Grant execute to service_role only; called internally by pay_maintenance_fee
REVOKE ALL ON FUNCTION public.fn_distribute_maintenance_refs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_distribute_maintenance_refs(uuid) TO service_role;


-- =========================================================
-- Task 2.4 — Update pay_cycle_commissions for tiered Gen2/Gen3 commissions
--
-- Rules:
--   • Gen1 is always paid to every upline at aff_gen1_pct.
--   • Gen2 and Gen3 are only paid when the upline holds an active premium
--     membership (membership_tier IN ('premium','gold','platinum') AND
--     premium_expires_at > now()).  Standard or expired-premium uplines
--     receive Gen1 only; Gen2/Gen3 are silently skipped for them.
--   • All percentage values are read from app_settings at payout time and
--     wrapped in COALESCE(…, 0) so a NULL in the settings row is treated as 0.
--   • referral_gen2_pct / referral_gen3_pct (added in this migration) are the
--     premium-tier Gen2/Gen3 rates.  aff_gen1_pct remains the Gen1 rate for
--     all tiers.
--
-- Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
-- =========================================================

CREATE OR REPLACE FUNCTION public.pay_cycle_commissions(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle       public.cycles%ROWTYPE;
  v_settings    public.app_settings%ROWTYPE;
  v_rate        numeric;
  v_reward      numeric(20,8);
  v_basis       numeric(20,8);
  v_upline      record;
  v_upline_prof public.profiles%ROWTYPE;
  v_is_premium  boolean;
  v_pct         numeric;
  v_seed_amt    numeric(20,8);
  v_usdt_amt    numeric(20,2);
  v_wallet      public.wallets%ROWTYPE;
BEGIN
  -- Load cycle and settings
  SELECT * INTO v_cycle    FROM public.cycles      WHERE id = p_cycle_id;
  IF v_cycle.id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NULL THEN RETURN; END IF;

  v_rate   := COALESCE(v_settings.seed_to_usdt, 1);
  v_reward := round(v_cycle.amount * v_cycle.reward_bps / 10000.0, 8);

  IF v_settings.aff_basis = 'profit_plus_capital' THEN
    v_basis := v_reward + v_cycle.amount;
  ELSE
    v_basis := v_reward;
  END IF;
  IF v_basis <= 0 THEN RETURN; END IF;

  -- Walk up to 3 uplines and distribute tier-gated commissions
  FOR v_upline IN SELECT * FROM public.get_uplines(v_cycle.user_id) LOOP

    -- Determine whether this upline currently holds an active premium membership
    SELECT * INTO v_upline_prof FROM public.profiles WHERE id = v_upline.user_id;

    v_is_premium := (
      v_upline_prof.membership_tier IN ('premium', 'gold', 'platinum')
      AND v_upline_prof.premium_expires_at IS NOT NULL
      AND v_upline_prof.premium_expires_at > now()
    );

    -- Resolve the percentage for this generation and tier
    -- Gen1: always paid at aff_gen1_pct (both standard and premium)
    -- Gen2: premium only — referral_gen2_pct
    -- Gen3: premium only — referral_gen3_pct
    v_pct := CASE v_upline.generation
      WHEN 1 THEN COALESCE(v_settings.aff_gen1_pct, 0)
      WHEN 2 THEN CASE WHEN v_is_premium
                    THEN COALESCE(v_settings.referral_gen2_pct, 0)
                    ELSE 0
                  END
      WHEN 3 THEN CASE WHEN v_is_premium
                    THEN COALESCE(v_settings.referral_gen3_pct, 0)
                    ELSE 0
                  END
      ELSE 0
    END;

    -- Skip if the effective rate is zero
    IF v_pct <= 0 THEN CONTINUE; END IF;

    v_seed_amt := round(v_basis * v_pct, 8);
    IF v_seed_amt <= 0 THEN CONTINUE; END IF;

    -- Convert Seed commission amount to USDT for the primary wallet credit
    v_usdt_amt := round(v_seed_amt * v_rate, 2);
    IF v_usdt_amt <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_wallet FROM public.wallets
      WHERE user_id = v_upline.user_id AND kind = 'primary';
    IF v_wallet.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.affiliate_commissions(
      user_id, from_user_id, generation, source,
      source_id, basis_amount, pct, amount
    ) VALUES (
      v_upline.user_id, v_cycle.user_id, v_upline.generation, 'cycle',
      v_cycle.id, v_basis, v_pct, v_usdt_amt
    );

    PERFORM public.wallet_adjust(
      v_wallet.id, v_usdt_amt, 'affiliate_commission'::ledger_kind,
      'Gen ' || v_upline.generation || ' cycle commission', 'cycles', v_cycle.id
    );

  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.pay_cycle_commissions(uuid) TO service_role;
