
-- Maintenance mode + editable ticker + affiliate admin policy

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS maint_mode_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maint_message text NOT NULL DEFAULT 'We are performing scheduled maintenance. Please check back soon.',
  ADD COLUMN IF NOT EXISTS maint_pages jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ticker_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ticker_items jsonb NOT NULL DEFAULT '[
    {"icon":"users","label":"12,847 Farmers"},
    {"icon":"sprout","label":"1 USDT = 1 Seed"},
    {"icon":"trending-up","label":"+8.4% Avg. Cycle Yield"},
    {"icon":"coins","label":"2,184,920 Seeds in Circulation"},
    {"icon":"trending-up","label":"$48,210 Reaped Today"},
    {"icon":"users","label":"342 New Farmers This Week"}
  ]'::jsonb;

-- Public read of maintenance + ticker state (anon can read app_settings already via existing policy).

-- Admin-write affiliate_commissions (currently only earner SELECT). Admins
-- may need to correct or void erroneous entries.
DROP POLICY IF EXISTS "Admins manage affiliate commissions" ON public.affiliate_commissions;
CREATE POLICY "Admins manage affiliate commissions"
  ON public.affiliate_commissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin RPC to update maintenance + ticker settings in one call.
CREATE OR REPLACE FUNCTION public.admin_set_maintenance(
  p_global boolean,
  p_message text,
  p_pages jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE public.app_settings
     SET maint_mode_global = COALESCE(p_global, false),
         maint_message     = COALESCE(p_message, maint_message),
         maint_pages       = COALESCE(p_pages, '{}'::jsonb),
         updated_at        = now()
   WHERE id = true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_ticker(
  p_enabled boolean,
  p_items jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'ticker items must be an array';
  END IF;
  UPDATE public.app_settings
     SET ticker_enabled = COALESCE(p_enabled, true),
         ticker_items   = p_items,
         updated_at     = now()
   WHERE id = true;
END $$;
