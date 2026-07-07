-- =========================================================
-- Achievement Notifications + Description field
-- 1. Add description column to achievement_rewards
-- 2. Add achievement_unlocked to notification_kind enum
-- 3. Update fn_claim_achievement to fire a notification
-- =========================================================

-- 1. Add description to achievement_rewards ----------------------------
ALTER TABLE public.achievement_rewards
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- Backfill descriptions for all seeded achievements
UPDATE public.achievement_rewards SET description = CASE achievement_id
  -- Welcome
  WHEN 'acc-created'      THEN 'Create your VFarmers account.'
  WHEN 'profile-setup'    THEN 'Complete your profile: display name, username, avatar, and country.'
  WHEN 'prem-upgrade'     THEN 'Upgrade to a Premium membership tier.'
  -- Farming
  WHEN 'first-harvest'    THEN 'Complete your first farming cycle.'
  WHEN 'consistent'       THEN 'Reap 10 farming cycles.'
  WHEN 'master-farmer'    THEN 'Reap 50 farming cycles.'
  WHEN 'farm-lord'        THEN 'Reap 100 farming cycles.'
  WHEN 'farm-legend'      THEN 'Reap 500 farming cycles — legendary status.'
  -- Deposits
  WHEN 'first-deposit'    THEN 'Make your first deposit of any amount.'
  WHEN 'growing-inv'      THEN 'Reach 100 USDT in total deposits.'
  WHEN 'estab-farmer'     THEN 'Reach 500 USDT in total deposits.'
  WHEN 'farm-owner'       THEN 'Reach 1,000 USDT in total deposits.'
  WHEN 'agr-tycoon'       THEN 'Reach 10,000 USDT in total deposits.'
  WHEN 'first-withdraw'   THEN 'Complete your first withdrawal.'
  WHEN 'fin-freedom'      THEN 'Withdraw a total of 500 USDT.'
  WHEN 'cash-flow'        THEN 'Withdraw a total of 5,000 USDT.'
  -- Earnings
  WHEN 'first-profit'     THEN 'Earn 1 Seed in farming rewards.'
  WHEN 'seed-collector'   THEN 'Earn 100 Seeds in farming rewards.'
  WHEN 'seed-millionaire' THEN 'Earn 1,000 Seeds in farming rewards.'
  WHEN 'seed-legend'      THEN 'Earn 10,000 Seeds in farming rewards.'
  WHEN 'ref-income'       THEN 'Earn your first referral commission.'
  WHEN 'ref-expert'       THEN 'Earn 100 USDT from referral commissions.'
  WHEN 'ref-master'       THEN 'Earn 1,000 USDT from referral commissions.'
  -- Network
  WHEN 'first-referral'   THEN 'Invite your first farmer.'
  WHEN 'comm-builder'     THEN 'Refer 5 farmers.'
  WHEN 'team-leader'      THEN 'Grow your Gen 1 downline to 20 farmers.'
  WHEN 'net-champ'        THEN 'Refer 100 farmers.'
  WHEN 'ref-king'         THEN 'Refer 500 farmers.'
  WHEN 'prod-sponsor'     THEN 'Have 3 active Gen 1 referrals.'
  WHEN 'team-builder'     THEN 'Have 10 active referrals.'
  WHEN 'empire-builder'   THEN 'Build a network of 100+ across 3 generations.'
  WHEN 'kingdom'          THEN '250+ farmers in your downline network.'
  WHEN 'prem-gen1-50'     THEN 'Refer 50 Premium farmers within any 90-day period.'
  WHEN 'prem-gen1-100'    THEN 'Refer 100 Premium farmers within any 90-day period.'
  WHEN 'prem-net-500'     THEN '500 Premium members in your network within any 90-day period.'
  WHEN 'prem-net-1000'    THEN '1,000 Premium members in your network within any 90-day period.'
  -- Trading
  WHEN 'first-transfer'   THEN 'Send your first P2P transfer.'
  WHEN 'comm-helper'      THEN 'Complete 10 P2P transfers.'
  WHEN 'merch-farmer'     THEN 'Complete 100 P2P transfers.'
  WHEN 'first-escrow'     THEN 'Complete one escrow transaction.'
  WHEN 'trusted-trader'   THEN 'Complete 25 escrow trades.'
  WHEN 'mkt-veteran'      THEN 'Complete 100 escrow trades.'
  WHEN 'coupon-user'      THEN 'Redeem your first coupon.'
  WHEN 'coupon-coll'      THEN 'Redeem 10 coupons.'
  WHEN 'coupon-champ'     THEN 'Redeem 50 coupons.'
  -- Streaks
  WHEN 'farm-streak-3'    THEN 'Farm on 3 consecutive days.'
  WHEN 'farm-streak-7'    THEN 'Farm on 7 consecutive days without a break.'
  WHEN 'farm-streak-30'   THEN 'Farm every day for a full month.'
  WHEN 'farm-streak-100'  THEN 'Farm consistently for 100 days straight.'
  WHEN 'farm-streak-365'  THEN 'Farm every single day for 365 consecutive days.'
  WHEN 'ref-streak-3'     THEN 'Earn a referral commission on 3 consecutive days.'
  WHEN 'ref-streak-7'     THEN 'Earn a referral commission every day for 7 days.'
  WHEN 'ref-streak-30'    THEN 'Your team is active — commissions every day for 30 days.'
  WHEN 'ref-streak-100'   THEN '100 consecutive days of referral commission income.'
  WHEN 'ref-streak-365'   THEN '365 straight days of commission income — your team never sleeps.'
  -- Loyalty
  WHEN 'loyalty-30'       THEN 'Member for 30 days.'
  WHEN 'loyalty-90'       THEN 'Member for 90 days.'
  WHEN 'loyalty-180'      THEN 'Member for 180 days.'
  WHEN 'loyalty-365'      THEN 'Member for 365 days.'
  WHEN 'loyalty-1000'     THEN 'Member for 1,000 days.'
  WHEN 'prem-90'          THEN 'Remain Premium for 90 consecutive days.'
  WHEN 'prem-365'         THEN 'Remain Premium for 365 consecutive days.'
  -- Engagement
  WHEN 'first-booster'    THEN 'Use your first farming booster.'
  WHEN 'power-farmer'     THEN 'Use 10 farming boosters.'
  WHEN 'supercharged'     THEN 'Use 100 farming boosters.'
  WHEN 'pv-collector'     THEN 'Earn 100 Personal Volume points.'
  WHEN 'pv-champion'      THEN 'Earn 1,000 Personal Volume points.'
  WHEN 'acct-value-s'     THEN 'Hold 200 Seeds in your farming wallet.'
  WHEN 'acct-value-l'     THEN 'Hold 1,000 Seeds in your farming wallet.'
  WHEN 'acct-value-m'     THEN 'Hold 5,000 Seeds in your farming wallet.'
  WHEN 'acct-value-k'     THEN 'Hold 20,000 Seeds in your farming wallet.'
  -- Legendary / Hidden
  WHEN 'midnight'         THEN 'Farm after midnight 10 times.'
  WHEN 'early-bird'       THEN 'Farm before 6 AM on 20 occasions.'
  WHEN 'vfarm-legend'     THEN 'Member for 5 years — a true VFarmers pioneer.'
  ELSE description
END;

-- 2. Add achievement_unlocked to notification_kind enum ---------------
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'achievement_unlocked';

-- 3. Update fn_claim_achievement to fire a notification ---------------
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
  v_reward_label text;
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

  -- Credit PV (if any)
  IF v_reward.pv_reward > 0 THEN
    INSERT INTO public.pv_ledger (user_id, activity_code, points, ref_table, ref_id)
    VALUES (p_user_id, 'achievement_unlock', v_reward.pv_reward, 'achievement_claims', NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Build reward summary for notification body
  v_reward_label := CASE
    WHEN v_reward.pv_reward > 0 AND v_reward.usdt_reward > 0
      THEN '+' || v_reward.pv_reward || ' PV · +' || v_reward.usdt_reward || ' USDT credited.'
    WHEN v_reward.pv_reward > 0
      THEN '+' || v_reward.pv_reward || ' PV credited to your account.'
    WHEN v_reward.usdt_reward > 0
      THEN '+' || v_reward.usdt_reward || ' USDT credited to your Primary Wallet.'
    ELSE NULL
  END;

  -- Fire achievement_unlocked notification
  PERFORM public.notify_user(
    p_user_id,
    'achievement_unlocked'::public.notification_kind,
    '🏆 Achievement unlocked: ' || v_reward.title,
    COALESCE(v_reward_label, v_reward.description),
    'achievement_claims',
    NULL
  );
END $$;

GRANT EXECUTE ON FUNCTION public.fn_claim_achievement(uuid, text) TO authenticated;
