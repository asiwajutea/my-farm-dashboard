-- =========================================================
-- Booster CRUD (admin)
-- SECURITY DEFINER RPCs mirroring the coupon admin pattern: each is gated by
-- is_admin(auth.uid()) and writes an admin_audit row. Boosters are the farming
-- "plans" (reward bps + duration + cost). cost_seed stays in Seed (the ledger
-- unit); the admin UI presents it in USDT for input/display only.
-- =========================================================

-- Create a booster ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_booster(
  p_code           text,
  p_label          text,
  p_duration_hours integer,
  p_reward_bps     integer,
  p_cost_seed      numeric DEFAULT 0,
  p_active         boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_id    uuid;
  v_code  text := lower(trim(p_code));
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF v_code IS NULL OR length(v_code) = 0 THEN RAISE EXCEPTION 'Code required'; END IF;
  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN RAISE EXCEPTION 'Label required'; END IF;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 THEN RAISE EXCEPTION 'Duration must be positive'; END IF;
  IF p_reward_bps IS NULL OR p_reward_bps < 0 THEN RAISE EXCEPTION 'Reward must be >= 0'; END IF;
  IF p_cost_seed IS NULL OR p_cost_seed < 0 THEN RAISE EXCEPTION 'Cost must be >= 0'; END IF;

  INSERT INTO public.boosters (code, label, duration_hours, reward_bps, cost_seed, active)
  VALUES (v_code, trim(p_label), p_duration_hours, p_reward_bps, p_cost_seed, COALESCE(p_active, true))
  RETURNING id INTO v_id;

  PERFORM public.admin_audit(v_admin, 'booster_created', 'booster', v_id,
    jsonb_build_object('code', v_code, 'label', p_label, 'duration_hours', p_duration_hours,
                       'reward_bps', p_reward_bps, 'cost_seed', p_cost_seed));
  RETURN v_id;
END $$;

-- Update a booster -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_booster(
  p_id             uuid,
  p_label          text,
  p_duration_hours integer,
  p_reward_bps     integer,
  p_cost_seed      numeric,
  p_active         boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN RAISE EXCEPTION 'Label required'; END IF;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 THEN RAISE EXCEPTION 'Duration must be positive'; END IF;
  IF p_reward_bps IS NULL OR p_reward_bps < 0 THEN RAISE EXCEPTION 'Reward must be >= 0'; END IF;
  IF p_cost_seed IS NULL OR p_cost_seed < 0 THEN RAISE EXCEPTION 'Cost must be >= 0'; END IF;

  UPDATE public.boosters
     SET label = trim(p_label),
         duration_hours = p_duration_hours,
         reward_bps = p_reward_bps,
         cost_seed = p_cost_seed,
         active = COALESCE(p_active, true),
         updated_at = now()
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booster not found'; END IF;

  PERFORM public.admin_audit(v_admin, 'booster_updated', 'booster', p_id,
    jsonb_build_object('label', p_label, 'duration_hours', p_duration_hours,
                       'reward_bps', p_reward_bps, 'cost_seed', p_cost_seed, 'active', p_active));
END $$;

-- Enable / disable a booster -------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_booster_active(p_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.boosters SET active = COALESCE(p_active, false), updated_at = now() WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booster not found'; END IF;

  PERFORM public.admin_audit(v_admin,
    CASE WHEN p_active THEN 'booster_enabled' ELSE 'booster_disabled' END,
    'booster', p_id, '{}'::jsonb);
END $$;

-- Delete a booster -----------------------------------------------------------
-- Cycles reference boosters via booster_id (no FK cascade defined); a booster
-- that has been used should be disabled rather than deleted to preserve
-- history. We block deletion when cycles reference it and suggest disabling.
CREATE OR REPLACE FUNCTION public.admin_delete_booster(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF EXISTS (SELECT 1 FROM public.cycles WHERE booster_id = p_id) THEN
    RAISE EXCEPTION 'Booster has cycles; disable it instead of deleting';
  END IF;

  DELETE FROM public.boosters WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booster not found'; END IF;

  PERFORM public.admin_audit(v_admin, 'booster_deleted', 'booster', p_id, '{}'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_create_booster(text, text, integer, integer, numeric, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_booster(uuid, text, integer, integer, numeric, boolean)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_booster_active(uuid, boolean)                                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_booster(uuid)                                             TO authenticated, service_role;
