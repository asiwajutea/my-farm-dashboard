-- =========================================================
-- Deposit Channel Controls
-- Adds per-channel lock/enable settings to app_settings.
-- =========================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ivorypay_enabled              boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ivorypay_daily_limit_usdt     numeric  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ivorypay_locked_reason        text,
  ADD COLUMN IF NOT EXISTS manual_deposit_enabled        boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_deposit_locked_reason  text;
