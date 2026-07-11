-- =========================================================
-- IvoryPay Integration
-- Adds external_ref to deposit_requests so the webhook can
-- match an IvoryPay callback to the correct pending deposit.
-- =========================================================

ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS external_ref text;

-- Index for fast webhook lookups by IvoryPay transaction reference
CREATE INDEX IF NOT EXISTS deposit_requests_external_ref_idx
  ON public.deposit_requests (external_ref)
  WHERE external_ref IS NOT NULL;
