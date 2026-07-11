-- =========================================================
-- Deposit Channel Settings
-- Adds per-channel lock flags and IvoryPay daily cap to app_settings.
-- All values are configurable by the admin; no defaults are hardcoded.
-- =========================================================

-- IvoryPay channel controls
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ivorypay_enabled          boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ivorypay_daily_limit_usdt numeric  NOT NULL DEFAULT 0,   -- 0 = unlimited
  ADD COLUMN IF NOT EXISTS ivorypay_locked_reason    text;    -- optional message shown to users

-- Manual deposit channel controls
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS manual_deposit_enabled    boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_deposit_locked_reason text;

-- CHECK: daily limit must be non-negative
DO $$ BEGIN
  ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_ivorypay_daily_limit_check
      CHECK (ivorypay_daily_limit_usdt >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
