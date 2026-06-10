-- =========================================================
-- Payout lock window + withdrawal conversion-rate freeze
--
-- 1. Persist the conversion rate + USDT payout amount on each withdrawal
--    request so a later rate change never alters an already-placed request.
-- 2. Add the bi-weekly payout schedule config to the app_settings singleton
--    that drives the Thursday 00:00 -> Friday 23:59 withdrawal lock window.
-- 3. Admin RPC to edit the schedule (authenticated has SELECT-only on
--    app_settings, so writes go through a SECURITY DEFINER function, mirroring
--    admin_set_maintenance / admin_set_ticker).
-- =========================================================

-- 1. Freeze rate + USDT payout on withdrawal_requests -----------------------

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS locked_rate numeric(20, 8),
  ADD COLUMN IF NOT EXISTS amount_usdt numeric(20, 2);

COMMENT ON COLUMN public.withdrawal_requests.locked_rate IS
  'USDT value of 1 Seed (app_settings.seed_to_usdt) captured when the request was placed.';
COMMENT ON COLUMN public.withdrawal_requests.amount_usdt IS
  'USDT payout locked at request time = round(amount * locked_rate, 2). Independent of later rate changes.';

-- Backfill existing rows from the current conversion rate so history and the
-- admin queue render a locked USDT payout for them too.
UPDATE public.withdrawal_requests w
   SET locked_rate = s.seed_to_usdt,
       amount_usdt = round(w.amount * s.seed_to_usdt, 2)
  FROM public.app_settings s
 WHERE s.id = true
   AND w.locked_rate IS NULL;

-- 2. Bi-weekly payout schedule config --------------------------------------
-- payout_anchor must be a payout Friday; payouts recur every 14 days from it.
-- 2026-06-12 is a Friday.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS payout_anchor date NOT NULL DEFAULT '2026-06-12',
  ADD COLUMN IF NOT EXISTS payout_lock_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payout_timezone text NOT NULL DEFAULT 'Africa/Lagos';

-- 3. Admin RPC to update the payout schedule --------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_payout(
  p_anchor date,
  p_lock_enabled boolean,
  p_timezone text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_anchor IS NULL THEN
    RAISE EXCEPTION 'Anchor date required';
  END IF;
  IF p_timezone IS NULL OR length(trim(p_timezone)) = 0 THEN
    RAISE EXCEPTION 'Timezone required';
  END IF;
  -- Validate the IANA time zone — this raises if the name is not recognized.
  PERFORM now() AT TIME ZONE trim(p_timezone);

  UPDATE public.app_settings
     SET payout_anchor       = p_anchor,
         payout_lock_enabled = COALESCE(p_lock_enabled, true),
         payout_timezone     = trim(p_timezone),
         updated_at          = now()
   WHERE id = true;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_set_payout(date, boolean, text) TO authenticated, service_role;
