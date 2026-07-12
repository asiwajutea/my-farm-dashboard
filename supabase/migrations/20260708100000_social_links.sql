-- =========================================================
-- Social Community Links
-- Adds Telegram group and channel URL fields to app_settings
-- so the admin can set them from the backend.
-- =========================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS telegram_group_url   text,
  ADD COLUMN IF NOT EXISTS telegram_channel_url text;
