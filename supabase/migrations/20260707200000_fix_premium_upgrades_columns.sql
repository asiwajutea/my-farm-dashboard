-- =========================================================
-- Fix premium_upgrades table — add missing columns that
-- were defined in the premium_membership migration but may
-- not have been applied to the live database.
-- All ALTER TABLE statements are guarded with IF NOT EXISTS.
-- =========================================================

-- Add paid_from_wallet if missing
ALTER TABLE public.premium_upgrades
  ADD COLUMN IF NOT EXISTS paid_from_wallet text NOT NULL DEFAULT 'primary';

-- Add the CHECK constraint if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.premium_upgrades
    ADD CONSTRAINT premium_upgrades_paid_from_wallet_check
      CHECK (paid_from_wallet IN ('primary', 'farming'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add tier column if missing (requires membership_tier enum to exist)
DO $$ BEGIN
  ALTER TABLE public.premium_upgrades
    ADD COLUMN IF NOT EXISTS tier public.membership_tier NOT NULL DEFAULT 'premium';
EXCEPTION WHEN undefined_object THEN
  -- membership_tier enum doesn't exist yet — add tier as text instead
  ALTER TABLE public.premium_upgrades
    ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'premium';
END $$;

-- Add activated_at if missing
ALTER TABLE public.premium_upgrades
  ADD COLUMN IF NOT EXISTS activated_at timestamptz NOT NULL DEFAULT now();

-- Add expires_at if missing
ALTER TABLE public.premium_upgrades
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 year');

-- Add tx_ref if missing
ALTER TABLE public.premium_upgrades
  ADD COLUMN IF NOT EXISTS tx_ref text;

-- Ensure the table exists at all (creates it if somehow absent)
CREATE TABLE IF NOT EXISTS public.premium_upgrades (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usdt      numeric(18, 6) NOT NULL DEFAULT 0,
  paid_from_wallet text NOT NULL DEFAULT 'primary' CHECK (paid_from_wallet IN ('primary', 'farming')),
  tier             text NOT NULL DEFAULT 'premium',
  activated_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  tx_ref           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Grants (idempotent)
GRANT SELECT ON public.premium_upgrades TO authenticated;
GRANT ALL    ON public.premium_upgrades TO service_role;

-- RLS
ALTER TABLE public.premium_upgrades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own upgrades"
    ON public.premium_upgrades FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
