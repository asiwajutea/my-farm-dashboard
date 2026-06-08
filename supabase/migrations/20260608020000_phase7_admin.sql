-- =========================================================
-- Phase 7: Admin tooling
-- Audit log + profiles.frozen flag + SECURITY DEFINER admin RPCs.
-- Every admin mutation is atomic and writes one admin_audit_log row.
-- Money movement reuses the service-role-only wallet_adjust() mutator
-- (callable from these SECURITY DEFINER functions, same as start_cycle).
-- Authorization is enforced INSIDE each RPC via public.is_admin(auth.uid()).
-- =========================================================

-- 1. Frozen flag on profiles ------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false;

-- 2. Admin audit log --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC, id DESC);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL    ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins may read the audit log; rows are written by SECURITY DEFINER RPCs.
CREATE POLICY "Admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Internal helper: append an audit row. SECURITY DEFINER so it can insert
-- regardless of the caller's RLS. Not granted to anyone directly — only called
-- from the admin RPCs below (which run as definer).
CREATE OR REPLACE FUNCTION public.admin_audit(
  p_actor       uuid,
  p_action      text,
  p_target_type text,
  p_target_id   uuid,
  p_detail      jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, detail)
  VALUES (p_actor, p_action, p_target_type, p_target_id, COALESCE(p_detail, '{}'::jsonb));
$$;

-- 3. RPC: admin_review_request ----------------------------------------------
-- Approve or reject a pending deposit/withdrawal. On approval the money moves
-- through the atomic ledger: deposits credit, withdrawals debit the primary
-- wallet. Rejections only set status + note. Idempotent on already-decided rows.
CREATE OR REPLACE FUNCTION public.admin_review_request(
  p_type    text,          -- 'deposit' | 'withdrawal'
  p_id      uuid,
  p_approve boolean,
  p_note    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin   uuid := auth.uid();
  v_user    uuid;
  v_amount  numeric(20,8);
  v_status  public.request_status;
  v_wallet  uuid;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_type NOT IN ('deposit','withdrawal') THEN RAISE EXCEPTION 'Invalid request type'; END IF;

  IF p_type = 'deposit' THEN
    SELECT user_id, amount, status INTO v_user, v_amount, v_status
      FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  ELSE
    SELECT user_id, amount, status INTO v_user, v_amount, v_status
      FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  END IF;

  IF v_user IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_status; END IF;

  IF p_approve THEN
    SELECT id INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

    IF p_type = 'deposit' THEN
      PERFORM public.wallet_adjust(v_wallet, v_amount, 'deposit'::ledger_kind,
        COALESCE(p_note, 'Deposit approved'), 'deposit_requests', p_id);
      UPDATE public.deposit_requests
        SET status = 'approved', admin_note = NULLIF(trim(p_note), ''), updated_at = now()
        WHERE id = p_id;
    ELSE
      -- Debit available balance; wallet_adjust raises if insufficient.
      PERFORM public.wallet_adjust(v_wallet, -v_amount, 'withdrawal'::ledger_kind,
        COALESCE(p_note, 'Withdrawal approved'), 'withdrawal_requests', p_id);
      UPDATE public.withdrawal_requests
        SET status = 'approved', admin_note = NULLIF(trim(p_note), ''), updated_at = now()
        WHERE id = p_id;
    END IF;
  ELSE
    IF p_type = 'deposit' THEN
      UPDATE public.deposit_requests
        SET status = 'rejected', admin_note = NULLIF(trim(p_note), ''), updated_at = now()
        WHERE id = p_id;
    ELSE
      UPDATE public.withdrawal_requests
        SET status = 'rejected', admin_note = NULLIF(trim(p_note), ''), updated_at = now()
        WHERE id = p_id;
    END IF;
  END IF;

  PERFORM public.admin_audit(
    v_admin,
    CASE WHEN p_approve THEN 'request_approved' ELSE 'request_rejected' END,
    p_type || '_request', p_id,
    jsonb_build_object('amount', v_amount, 'user_id', v_user, 'note', p_note)
  );
END $$;

-- 4. RPC: admin_adjust_balance ----------------------------------------------
-- Manually credit (+) or debit (-) a Farmer's primary wallet.
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user   uuid,
  p_amount numeric,         -- signed, non-zero
  p_memo   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin  uuid := auth.uid();
  v_wallet uuid;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'Amount must be non-zero'; END IF;

  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = p_user AND kind = 'primary';
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  PERFORM public.wallet_adjust(
    v_wallet, p_amount,
    CASE WHEN p_amount > 0 THEN 'admin_credit'::ledger_kind ELSE 'admin_debit'::ledger_kind END,
    COALESCE(NULLIF(trim(p_memo), ''), 'Admin adjustment'), 'profiles', p_user
  );

  PERFORM public.admin_audit(v_admin, 'balance_adjusted', 'user', p_user,
    jsonb_build_object('amount', p_amount, 'memo', p_memo));
END $$;

-- 5. RPC: admin_set_frozen --------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_frozen(p_user uuid, p_frozen boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET frozen = COALESCE(p_frozen, false), updated_at = now() WHERE id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;

  PERFORM public.admin_audit(v_admin,
    CASE WHEN p_frozen THEN 'farmer_frozen' ELSE 'farmer_unfrozen' END,
    'user', p_user, '{}'::jsonb);
END $$;

-- 6. RPC: admin_cancel_cycle ------------------------------------------------
-- Cancel an active cycle and refund the principal to the farming wallet.
CREATE OR REPLACE FUNCTION public.admin_cancel_cycle(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin  uuid := auth.uid();
  v_c      public.cycles%ROWTYPE;
  v_wallet uuid;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_c FROM public.cycles WHERE id = p_cycle_id FOR UPDATE;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'Cycle not found'; END IF;
  IF v_c.status <> 'active' THEN RAISE EXCEPTION 'Only active cycles can be cancelled'; END IF;

  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = v_c.user_id AND kind = 'farming';
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Farming wallet not found'; END IF;

  UPDATE public.cycles SET status = 'cancelled', updated_at = now() WHERE id = p_cycle_id;

  PERFORM public.wallet_adjust(v_wallet, v_c.amount, 'adjustment'::ledger_kind,
    'Cycle cancelled by admin — principal refunded', 'cycles', p_cycle_id);

  PERFORM public.admin_audit(v_admin, 'cycle_cancelled', 'cycle', p_cycle_id,
    jsonb_build_object('amount', v_c.amount, 'user_id', v_c.user_id));
END $$;

-- 7. RPC: admin_force_mature_cycle ------------------------------------------
-- Bring an active cycle's maturity forward to now so the Farmer can reap it.
CREATE OR REPLACE FUNCTION public.admin_force_mature_cycle(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_c     public.cycles%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_c FROM public.cycles WHERE id = p_cycle_id FOR UPDATE;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'Cycle not found'; END IF;
  IF v_c.status <> 'active' THEN RAISE EXCEPTION 'Only active cycles can be matured'; END IF;

  UPDATE public.cycles SET matures_at = now(), updated_at = now() WHERE id = p_cycle_id;

  PERFORM public.admin_audit(v_admin, 'cycle_matured', 'cycle', p_cycle_id,
    jsonb_build_object('user_id', v_c.user_id));
END $$;

-- 8. RPC: admin_create_coupon -----------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_coupon(
  p_code    text,
  p_amount  numeric,
  p_max     integer,
  p_expires timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_id    uuid;
  v_code  text := upper(trim(p_code));
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF v_code IS NULL OR length(v_code) = 0 THEN RAISE EXCEPTION 'Code required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_max IS NULL OR p_max < 1 THEN RAISE EXCEPTION 'Max redemptions must be >= 1'; END IF;

  INSERT INTO public.coupons (code, amount, max_redemptions, expires_at, active, created_by)
  VALUES (v_code, p_amount, p_max, p_expires, true, v_admin)
  RETURNING id INTO v_id;

  PERFORM public.admin_audit(v_admin, 'coupon_created', 'coupon', v_id,
    jsonb_build_object('code', v_code, 'amount', p_amount, 'max', p_max));
  RETURN v_id;
END $$;

-- 9. RPC: admin_set_coupon_active -------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_coupon_active(p_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.coupons SET active = COALESCE(p_active, false), updated_at = now() WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found'; END IF;

  PERFORM public.admin_audit(v_admin,
    CASE WHEN p_active THEN 'coupon_enabled' ELSE 'coupon_disabled' END,
    'coupon', p_id, '{}'::jsonb);
END $$;

-- 10. Grants on admin RPCs --------------------------------------------------
-- Granted to authenticated; each function enforces is_admin() internally.
GRANT EXECUTE ON FUNCTION public.admin_review_request(text, uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_frozen(uuid, boolean)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_cycle(uuid)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_mature_cycle(uuid)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_coupon(text, numeric, integer, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_coupon_active(uuid, boolean)          TO authenticated, service_role;
