-- =========================================================
-- Achievement Rewards System
-- Stores per-achievement reward config (PV + USDT) and
-- tracks which users have already claimed each reward.
-- =========================================================

-- 1. achievement_rewards — one row per achievement_id -----------------------
CREATE TABLE IF NOT EXISTS public.achievement_rewards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id  text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  category        text        NOT NULL DEFAULT 'general',
  pv_reward       numeric(12,4) NOT NULL DEFAULT 0,
  usdt_reward     numeric(18,6) NOT NULL DEFAULT 0,
  enabled         boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS achievement_rewards_id_idx
  ON public.achievement_rewards (achievement_id);

GRANT SELECT ON public.achievement_rewards TO authenticated;
GRANT ALL    ON public.achievement_rewards TO service_role;

ALTER TABLE public.achievement_rewards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone authenticated can read achievement rewards"
    ON public.achievement_rewards FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS achievement_rewards_updated_at ON public.achievement_rewards;
CREATE TRIGGER achievement_rewards_updated_at
  BEFORE UPDATE ON public.achievement_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. achievement_claims — prevents double-claiming --------------------------
CREATE TABLE IF NOT EXISTS public.achievement_claims (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id  text        NOT NULL,
  pv_awarded      numeric(12,4) NOT NULL DEFAULT 0,
  usdt_awarded    numeric(18,6) NOT NULL DEFAULT 0,
  claimed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS achievement_claims_user_ach_idx
  ON public.achievement_claims (user_id, achievement_id);

CREATE INDEX IF NOT EXISTS achievement_claims_user_idx
  ON public.achievement_claims (user_id);

GRANT SELECT, INSERT ON public.achievement_claims TO authenticated;
GRANT ALL ON public.achievement_claims TO service_role;

ALTER TABLE public.achievement_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own claims"
    ON public.achievement_claims FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. fn_claim_achievement — atomic reward credit ----------------------------
-- Called server-side only. Credits PV ledger + primary wallet (USDT).
-- Idempotent: raises an exception if already claimed.
CREATE OR REPLACE FUNCTION public.fn_claim_achievement(
  p_user_id       uuid,
  p_achievement_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reward  public.achievement_rewards%ROWTYPE;
  v_wallet  public.wallets%ROWTYPE;
BEGIN
  -- Load reward config
  SELECT * INTO v_reward
    FROM public.achievement_rewards
   WHERE achievement_id = p_achievement_id
     AND enabled = true;

  IF v_reward.id IS NULL THEN
    RAISE EXCEPTION 'Achievement reward not found or disabled: %', p_achievement_id;
  END IF;

  -- Guard: already claimed?
  IF EXISTS (
    SELECT 1 FROM public.achievement_claims
     WHERE user_id = p_user_id AND achievement_id = p_achievement_id
  ) THEN
    RAISE EXCEPTION 'Achievement already claimed';
  END IF;

  -- Record the claim first (unique constraint prevents race condition)
  INSERT INTO public.achievement_claims (user_id, achievement_id, pv_awarded, usdt_awarded)
  VALUES (p_user_id, p_achievement_id, v_reward.pv_reward, v_reward.usdt_reward);

  -- Credit USDT to primary wallet (if any)
  IF v_reward.usdt_reward > 0 THEN
    SELECT * INTO v_wallet
      FROM public.wallets
     WHERE user_id = p_user_id AND kind = 'primary';

    IF v_wallet.id IS NOT NULL THEN
      PERFORM public.wallet_adjust(
        v_wallet.id,
        v_reward.usdt_reward,
        'admin_credit'::public.ledger_kind,
        'Achievement reward: ' || v_reward.title,
        'achievement_claims',
        NULL
      );
    END IF;
  END IF;

  -- Credit PV (if any) — insert into pv_ledger
  IF v_reward.pv_reward > 0 THEN
    INSERT INTO public.pv_ledger (user_id, activity_code, points, ref_table, ref_id)
    VALUES (p_user_id, 'achievement_unlock', v_reward.pv_reward, 'achievement_claims', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_claim_achievement(uuid, text) TO authenticated;

-- 4. Seed all achievement rewards (edit via admin page later) ---------------
INSERT INTO public.achievement_rewards (achievement_id, title, category, pv_reward, usdt_reward) VALUES
  -- Welcome
  ('acc-created',     'First Seed',             'welcome',    5,    0),
  ('profile-setup',   'First Farmer',            'welcome',    10,   0),
  ('prem-upgrade',    'Premium Farmer',          'welcome',    50,   0),
  -- Farming
  ('first-harvest',   'First Harvest',           'farming',    5,    0),
  ('consistent',      'Consistent Farmer',       'farming',    25,   0),
  ('master-farmer',   'Master Farmer',           'farming',    100,  0),
  ('farm-lord',       'Farm Lord',               'farming',    200,  1),
  ('farm-legend',     'Legendary Farmer',        'farming',    500,  5),
  -- Deposits
  ('first-deposit',   'First Deposit',           'deposits',   10,   0),
  ('growing-inv',     'Growing Investor',        'deposits',   25,   0),
  ('estab-farmer',    'Established Farmer',      'deposits',   50,   0),
  ('farm-owner',      'Farm Owner',              'deposits',   100,  1),
  ('agr-tycoon',      'Agricultural Tycoon',     'deposits',   500,  10),
  ('first-withdraw',  'First Withdrawal',        'deposits',   5,    0),
  ('fin-freedom',     'Financial Freedom',       'deposits',   100,  0),
  ('cash-flow',       'Cash Flow Master',        'deposits',   500,  5),
  -- Earnings
  ('first-profit',    'First Profit',            'earnings',   5,    0),
  ('seed-collector',  'Seed Collector',          'earnings',   25,   0),
  ('seed-millionaire','Seed Millionaire',        'earnings',   100,  0),
  ('seed-legend',     'Seed Legend',             'earnings',   500,  5),
  ('ref-income',      'First Referral Income',   'earnings',   10,   0),
  ('ref-expert',      'Referral Expert',         'earnings',   50,   0),
  ('ref-master',      'Referral Master',         'earnings',   200,  2),
  -- Network
  ('first-referral',  'First Referral',          'network',    10,   0),
  ('comm-builder',    'Community Builder',       'network',    25,   0),
  ('team-leader',     'Team Leader',             'network',    50,   0),
  ('net-champ',       'Network Champion',        'network',    200,  2),
  ('ref-king',        'Referral King',           'network',    500,  10),
  ('prod-sponsor',    'Productive Sponsor',      'network',    15,   0),
  ('team-builder',    'Team Builder',            'network',    30,   0),
  ('empire-builder',  'Empire Builder',          'network',    100,  1),
  ('kingdom',         'Kingdom',                 'network',    500,  5),
  ('prem-gen1-50',    'Premium Recruiter',       'network',    500,  5),
  ('prem-gen1-100',   'Premium Commander',       'network',    1000, 10),
  ('prem-net-500',    'Premium Empire',          'network',    2000, 20),
  ('prem-net-1000',   'Premium Dynasty',         'network',    5000, 50),
  -- Trading
  ('first-transfer',  'First Transfer',          'trading',    5,    0),
  ('comm-helper',     'Community Helper',        'trading',    20,   0),
  ('merch-farmer',    'Merchant Farmer',         'trading',    100,  0),
  ('first-escrow',    'First Secure Trade',      'trading',    10,   0),
  ('trusted-trader',  'Trusted Trader',          'trading',    50,   0),
  ('mkt-veteran',     'Marketplace Veteran',     'trading',    200,  2),
  ('coupon-user',     'Coupon User',             'trading',    5,    0),
  ('coupon-coll',     'Coupon Collector',        'trading',    25,   0),
  ('coupon-champ',    'Coupon Champion',         'trading',    100,  0),
  -- Streaks
  ('farm-streak-3',   '3-Day Streak',            'streaks',    15,   0),
  ('farm-streak-7',   '7-Day Streak',            'streaks',    35,   0),
  ('farm-streak-30',  '30-Day Streak',           'streaks',    150,  1),
  ('farm-streak-100', '100-Day Streak',          'streaks',    500,  3),
  ('farm-streak-365', 'Never Missed a Day',      'streaks',    2000, 10),
  ('ref-streak-3',    '3-Day Network Streak',    'streaks',    10,   0),
  ('ref-streak-7',    '7-Day Network Streak',    'streaks',    50,   0),
  ('ref-streak-30',   '30-Day Network Streak',   'streaks',    200,  1),
  ('ref-streak-100',  'Network Machine',         'streaks',    500,  3),
  ('ref-streak-365',  'Unstoppable Network',     'streaks',    2000, 10),
  -- Loyalty
  ('loyalty-30',      'Bronze Farmer',           'loyalty',    20,   0),
  ('loyalty-90',      'Silver Farmer',           'loyalty',    50,   0),
  ('loyalty-180',     'Gold Farmer',             'loyalty',    100,  0),
  ('loyalty-365',     'Diamond Farmer',          'loyalty',    300,  2),
  ('loyalty-1000',    'Lifetime Farmer',         'loyalty',    1000, 10),
  ('prem-90',         'Elite Farmer',            'loyalty',    100,  0),
  ('prem-365',        'Veteran Premium Farmer',  'loyalty',    500,  5),
  -- Engagement / Boosters
  ('first-booster',   'Powered Up',              'engagement', 5,    0),
  ('power-farmer',    'Power Farmer',            'engagement', 30,   0),
  ('supercharged',    'Supercharged Farmer',     'engagement', 150,  1),
  ('pv-collector',    'PV Collector',            'engagement', 0,    0),
  ('pv-champion',     'PV Champion',             'engagement', 0,    0),
  ('acct-value-s',    'Small Farm',              'engagement', 10,   0),
  ('acct-value-l',    'Large Farm',              'engagement', 25,   0),
  ('acct-value-m',    'Mega Farm',               'engagement', 100,  0),
  ('acct-value-k',    'Kingdom Farm',            'engagement', 500,  5),
  -- Legendary / Hidden
  ('midnight',        'Midnight Farmer',         'legendary',  50,   0),
  ('early-bird',      'Early Bird',              'legendary',  50,   0),
  ('vfarm-legend',    'VFarm Legend',            'legendary',  5000, 50)
ON CONFLICT (achievement_id) DO NOTHING;
