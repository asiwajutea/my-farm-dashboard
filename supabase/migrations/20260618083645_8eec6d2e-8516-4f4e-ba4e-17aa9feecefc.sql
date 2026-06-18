
-- 1) Add new notification kinds
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'welcome';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'email_verified';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'affiliate_signup';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'p2p_sent';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'cycle_started';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'coupon_redeemed';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'kyc_submitted';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'maintenance_paid';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'transfer_to_farming';
