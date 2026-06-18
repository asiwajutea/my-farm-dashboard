-- =========================================================
-- Option A: Primary wallet becomes USDT-denominated
--
-- Rules:
--   wallets WHERE kind = 'primary'  → balance is in USDT
--   wallets WHERE kind = 'farming'  → balance is in Seed (unchanged)
--
-- Backfill: convert existing primary balances from Seed → USDT
--   using the current app_settings.seed_to_usdt rate.
--
-- All RPCs that credit/debit the primary wallet are updated to
-- work in USDT. The farming wallet and its RPCs are untouched.
-- =========================================================

-- 1. Backfill existing primary wallet balances (Seed → USDT) ---------------
DO $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'seed_to_usdt rate is zero or missing — cannot backfill';
  END IF;

  -- Convert primary wallet balances from Seed to USDT
  UPDATE public.wallets
     SET balance = round(balance * v_rate, 2),
         locked  = round(locked  * v_rate, 2),
         updated_at = now()
   WHERE kind = 'primary';

  -- Also convert existing primary ledger entries so history stays consistent
  UPDATE public.ledger_entries le
     SET amount        = round(le.amount        * v_rate, 2),
         balance_after = round(le.balance_after * v_rate, 2)
   FROM public.wallets w
  WHERE le.wallet_id = w.id
    AND w.kind = 'primary';
END $$;

-- 2. admin_review_request — deposit credits USDT, withdrawal debits USDT ----
-- Deposit: the amount in deposit_requests is Seed (legacy). Convert on credit.
-- Withdrawal: the amount_usdt field holds the correct USDT payout; use it.
CREATE OR REPLACE FUNCTION public.admin_review_request(
  p_type    text,
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
  v_admin      uuid := auth.uid();
  v_user       uuid;
  v_amount     numeric(20,8);   -- Seed amount from deposit_requests
  v_amount_usdt numeric(20,2);  -- USDT payout for withdrawals
  v_status     public.request_status;
  v_wallet     uuid;
  v_rate       numeric;
  v_credit     numeric(20,2);
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_type NOT IN ('deposit','withdrawal') THEN RAISE EXCEPTION 'Invalid request type'; END IF;

  IF p_type = 'deposit' THEN
    SELECT user_id, amount, status INTO v_user, v_amount, v_status
      FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  ELSE
    SELECT user_id, amount, amount_usdt, status INTO v_user, v_amount, v_amount_usdt, v_status
      FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  END IF;

  IF v_user IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_status; END IF;

  IF p_approve THEN
    SELECT id INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

    IF p_type = 'deposit' THEN
      -- Convert Seed amount → USDT using current rate for the credit
      SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
      IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Conversion rate unavailable'; END IF;
      v_credit := round(v_amount * v_rate, 2);
      PERFORM public.wallet_adjust(v_wallet, v_credit, 'deposit'::ledger_kind,
        COALESCE(p_note, 'Deposit approved'), 'deposit_requests', p_id);
      UPDATE public.deposit_requests
        SET status = 'approved', admin_note = NULLIF(trim(p_note),''), updated_at = now()
        WHERE id = p_id;
    ELSE
      -- Use the USDT payout locked at request time (amount_usdt), fallback to live calc
      SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
      IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Conversion rate unavailable'; END IF;
      v_credit := COALESCE(v_amount_usdt, round(v_amount * v_rate, 2));
      PERFORM public.wallet_adjust(v_wallet, -v_credit, 'withdrawal'::ledger_kind,
        COALESCE(p_note, 'Withdrawal approved'), 'withdrawal_requests', p_id);
      UPDATE public.withdrawal_requests
        SET status = 'approved', admin_note = NULLIF(trim(p_note),''), updated_at = now()
        WHERE id = p_id;
    END IF;
  ELSE
    IF p_type = 'deposit' THEN
      UPDATE public.deposit_requests
        SET status = 'rejected', admin_note = NULLIF(trim(p_note),''), updated_at = now()
        WHERE id = p_id;
    ELSE
      UPDATE public.withdrawal_requests
        SET status = 'rejected', admin_note = NULLIF(trim(p_note),''), updated_at = now()
        WHERE id = p_id;
    END IF;
  END IF;

  PERFORM public.admin_audit(v_admin,
    CASE WHEN p_approve THEN 'request_approved' ELSE 'request_rejected' END,
    p_type || '_request', p_id,
    jsonb_build_object('amount', v_amount, 'user_id', v_user, 'note', p_note));
END $$;

-- 3. transfer_to_farming — debit USDT from primary, credit Seed to farming --
-- The caller passes a USDT amount. We debit the primary wallet in USDT, then
-- compute the Seed equivalent and credit the farming wallet.
DROP FUNCTION IF EXISTS public.transfer_to_farming(numeric);
CREATE OR REPLACE FUNCTION public.transfer_to_farming(p_amount_usdt numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_rate   numeric;
  v_seed   numeric(20,8);
  v_pw     public.wallets%ROWTYPE;
  v_fw     public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount_usdt IS NULL OR p_amount_usdt <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Conversion rate unavailable'; END IF;
  v_seed := round(p_amount_usdt / v_rate, 8);

  SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  SELECT * INTO v_fw FROM public.wallets WHERE user_id = v_user AND kind = 'farming';
  IF v_fw.id IS NULL THEN
    INSERT INTO public.wallets (user_id, kind, balance, locked)
    VALUES (v_user, 'farming', 0, 0)
    RETURNING * INTO v_fw;
  END IF;

  IF (v_pw.balance - v_pw.locked) < p_amount_usdt THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Debit USDT from primary
  PERFORM public.wallet_adjust(v_pw.id, -p_amount_usdt, 'transfer_out'::ledger_kind,
    'Transfer to farming wallet', NULL, NULL);
  -- Credit Seed to farming
  PERFORM public.wallet_adjust(v_fw.id, v_seed, 'transfer_in'::ledger_kind,
    'Transfer from primary wallet', NULL, NULL);
END $$;

GRANT EXECUTE ON FUNCTION public.transfer_to_farming(numeric) TO authenticated;

-- 4. p2p_send — operates on primary wallets in USDT -----------------------
DROP FUNCTION IF EXISTS public.p2p_send(uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.p2p_send(
  p_receiver_id uuid,
  p_amount_usdt numeric,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender   uuid := auth.uid();
  v_settings public.app_settings%ROWTYPE;
  v_fee_pct  numeric := 0;
  v_fee      numeric(20,2);
  v_total    numeric(20,2);
  v_sw       public.wallets%ROWTYPE;
  v_rw       public.wallets%ROWTYPE;
  v_id       uuid;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_receiver_id IS NULL THEN RAISE EXCEPTION 'Receiver required'; END IF;
  IF p_receiver_id = v_sender THEN RAISE EXCEPTION 'Cannot send to yourself'; END IF;
  IF p_amount_usdt IS NULL OR p_amount_usdt <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NOT NULL THEN
    v_fee_pct := COALESCE(v_settings.p2p_fee_pct, 0);
  END IF;
  v_fee  := round(p_amount_usdt * v_fee_pct, 2);
  v_total := p_amount_usdt + v_fee;

  SELECT * INTO v_sw FROM public.wallets WHERE user_id = v_sender AND kind = 'primary';
  IF v_sw.id IS NULL THEN RAISE EXCEPTION 'Sender primary wallet not found'; END IF;
  SELECT * INTO v_rw FROM public.wallets WHERE user_id = p_receiver_id AND kind = 'primary';
  IF v_rw.id IS NULL THEN RAISE EXCEPTION 'Receiver primary wallet not found'; END IF;

  IF (v_sw.balance - v_sw.locked) < v_total THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.p2p_transfers (sender_id, receiver_id, amount, fee, note)
  VALUES (v_sender, p_receiver_id, p_amount_usdt, v_fee, p_note)
  RETURNING id INTO v_id;

  PERFORM public.wallet_transfer(
    v_sw.id, v_rw.id, p_amount_usdt,
    'p2p_out'::ledger_kind, 'p2p_in'::ledger_kind,
    COALESCE(p_note,'P2P transfer'), 'p2p_transfers', v_id
  );
  IF v_fee > 0 THEN
    PERFORM public.wallet_adjust(v_sw.id, -v_fee, 'p2p_fee'::ledger_kind,
      'P2P fee', 'p2p_transfers', v_id);
  END IF;

  RETURN v_id;
END $$;

-- 5. redeem_coupon — USDT coupon credits USDT directly to primary ----------
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_coupon public.coupons%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_red_id uuid;
  v_rate   numeric;
  v_credit numeric(20,8);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RAISE EXCEPTION 'Code required'; END IF;

  SELECT * INTO v_coupon FROM public.coupons WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'Invalid coupon code'; END IF;
  IF NOT v_coupon.active THEN RAISE EXCEPTION 'Coupon is inactive'; END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Coupon has expired';
  END IF;
  IF v_coupon.used_redemptions >= v_coupon.max_redemptions THEN
    RAISE EXCEPTION 'Coupon fully redeemed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Already redeemed';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  IF v_coupon.currency = 'usdt' THEN
    -- USDT coupon → credit USDT directly to primary wallet
    v_credit := v_coupon.amount;
  ELSE
    -- Seed coupon → convert to USDT at current rate
    SELECT seed_to_usdt INTO v_rate FROM public.app_settings WHERE id = true;
    IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Conversion rate unavailable'; END IF;
    v_credit := round(v_coupon.amount * v_rate, 2);
  END IF;
  IF v_credit <= 0 THEN RAISE EXCEPTION 'Nothing to credit'; END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, amount)
  VALUES (v_coupon.id, v_user, v_credit)
  RETURNING id INTO v_red_id;

  UPDATE public.coupons SET used_redemptions = used_redemptions + 1 WHERE id = v_coupon.id;

  PERFORM public.wallet_adjust(v_wallet.id, v_credit, 'coupon_redeem'::ledger_kind,
    'Coupon ' || v_coupon.code, 'coupons', v_coupon.id);

  RETURN v_red_id;
END $$;

-- 6. admin_adjust_balance — receives USDT directly -------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user   uuid,
  p_amount numeric,    -- signed USDT, non-zero
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
    COALESCE(NULLIF(trim(p_memo),''), 'Admin adjustment'), 'profiles', p_user
  );

  PERFORM public.admin_audit(v_admin, 'balance_adjusted', 'user', p_user,
    jsonb_build_object('amount', p_amount, 'memo', p_memo));
END $$;

-- 7. pay_maintenance_fee — debit USDT from primary -------------------------
-- Maintenance fee is stored in Seed (maint_fee_seed). Convert to USDT for debit.
CREATE OR REPLACE FUNCTION public.pay_maintenance_fee(p_fee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_fee      public.maintenance_fees%ROWTYPE;
  v_wallet   public.wallets%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_rate     numeric;
  v_usdt_amt numeric(20,2);
  v_upline   record;
  v_pct      numeric(6,4);
  v_amount   numeric(20,8);
  v_uwallet  public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_fee FROM public.maintenance_fees WHERE id = p_fee_id FOR UPDATE;
  IF v_fee.id IS NULL THEN RAISE EXCEPTION 'Fee not found'; END IF;
  IF v_fee.user_id <> v_user THEN RAISE EXCEPTION 'Not your fee'; END IF;
  IF v_fee.status = 'paid' THEN RAISE EXCEPTION 'Already paid'; END IF;
  IF v_fee.status = 'waived' THEN RAISE EXCEPTION 'Fee waived'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  v_rate := COALESCE(v_settings.seed_to_usdt, 1);
  -- Convert fee amount (Seed) to USDT for the debit
  v_usdt_amt := round(v_fee.amount * v_rate, 2);

  PERFORM public.wallet_adjust(v_wallet.id, -v_usdt_amt, 'maintenance_fee'::ledger_kind,
    'Maintenance fee ' || to_char(v_fee.period_start, 'YYYY-MM'), 'maintenance_fees', v_fee.id);

  UPDATE public.maintenance_fees SET status='paid', paid_at=now() WHERE id = p_fee_id;

  -- Pay affiliate commissions on the USDT amount (upline primary wallets are USDT)
  FOR v_upline IN SELECT * FROM public.get_uplines(v_user) LOOP
    v_pct := CASE v_upline.generation
      WHEN 1 THEN v_settings.aff_maint_gen1_pct
      WHEN 2 THEN v_settings.aff_maint_gen2_pct
      WHEN 3 THEN v_settings.aff_maint_gen3_pct
    END;
    IF v_pct IS NULL OR v_pct <= 0 THEN CONTINUE; END IF;
    v_amount := round(v_usdt_amt * v_pct, 2);
    IF v_amount <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_uwallet FROM public.wallets WHERE user_id = v_upline.user_id AND kind = 'primary';
    IF v_uwallet.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.affiliate_commissions(user_id, from_user_id, generation, source,
      source_id, basis_amount, pct, amount)
    VALUES (v_upline.user_id, v_user, v_upline.generation, 'maintenance',
      v_fee.id, v_usdt_amt, v_pct, v_amount);

    PERFORM public.wallet_adjust(v_uwallet.id, v_amount, 'affiliate_commission'::ledger_kind,
      'Gen ' || v_upline.generation || ' maintenance commission', 'maintenance_fees', v_fee.id);
  END LOOP;
END $$;

-- 8. reap_cycle — pay cycle commissions to primary wallet in USDT -----------
-- Commissions (aff_gen*_pct) are paid on cycle reward/principal.
-- Primary wallets are now USDT, so convert Seed commission to USDT.
CREATE OR REPLACE FUNCTION public.pay_cycle_commissions(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle    public.cycles%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_rate     numeric;
  v_reward   numeric(20,8);
  v_basis    numeric(20,8);
  v_upline   record;
  v_pct      numeric(6,4);
  v_seed_amt numeric(20,8);
  v_usdt_amt numeric(20,2);
  v_wallet   public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_cycle FROM public.cycles WHERE id = p_cycle_id;
  IF v_cycle.id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NULL THEN RETURN; END IF;

  v_rate   := COALESCE(v_settings.seed_to_usdt, 1);
  v_reward := round(v_cycle.amount * v_cycle.reward_bps / 10000.0, 8);

  IF v_settings.aff_basis = 'profit_plus_capital' THEN
    v_basis := v_reward + v_cycle.amount;
  ELSE
    v_basis := v_reward;
  END IF;
  IF v_basis <= 0 THEN RETURN; END IF;

  FOR v_upline IN SELECT * FROM public.get_uplines(v_cycle.user_id) LOOP
    v_pct := CASE v_upline.generation
      WHEN 1 THEN v_settings.aff_gen1_pct
      WHEN 2 THEN v_settings.aff_gen2_pct
      WHEN 3 THEN v_settings.aff_gen3_pct
    END;
    IF v_pct IS NULL OR v_pct <= 0 THEN CONTINUE; END IF;
    v_seed_amt := round(v_basis * v_pct, 8);
    IF v_seed_amt <= 0 THEN CONTINUE; END IF;

    -- Convert to USDT for the primary wallet credit
    v_usdt_amt := round(v_seed_amt * v_rate, 2);
    IF v_usdt_amt <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_upline.user_id AND kind = 'primary';
    IF v_wallet.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.affiliate_commissions(user_id, from_user_id, generation, source,
      source_id, basis_amount, pct, amount)
    VALUES (v_upline.user_id, v_cycle.user_id, v_upline.generation, 'cycle',
      v_cycle.id, v_basis, v_pct, v_usdt_amt);

    PERFORM public.wallet_adjust(v_wallet.id, v_usdt_amt, 'affiliate_commission'::ledger_kind,
      'Gen ' || v_upline.generation || ' cycle commission', 'cycles', v_cycle.id);
  END LOOP;
END $$;

-- 9. Escrow — lock/release/refund in USDT ----------------------------------
-- Redefine to use USDT for primary wallet amounts
CREATE OR REPLACE FUNCTION public.escrow_lock(p_escrow_id uuid, p_payer_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet uuid;
BEGIN
  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = p_payer_id AND kind = 'primary';
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;
  PERFORM public.wallet_adjust(v_wallet, -p_amount, 'escrow_lock'::ledger_kind,
    'Escrow locked', 'escrow_trades', p_escrow_id);
END $$;

CREATE OR REPLACE FUNCTION public.escrow_release_to_payee(p_escrow_id uuid, p_payee_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet uuid;
BEGIN
  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = p_payee_id AND kind = 'primary';
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;
  PERFORM public.wallet_adjust(v_wallet, p_amount, 'escrow_release'::ledger_kind,
    'Escrow released', 'escrow_trades', p_escrow_id);
END $$;

CREATE OR REPLACE FUNCTION public.escrow_refund_to_payer(p_escrow_id uuid, p_payer_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet uuid;
BEGIN
  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = p_payer_id AND kind = 'primary';
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;
  PERFORM public.wallet_adjust(v_wallet, p_amount, 'escrow_refund'::ledger_kind,
    'Escrow refunded', 'escrow_trades', p_escrow_id);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_review_request(text, uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_to_farming(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p2p_send(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_maintenance_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_cycle_commissions(uuid) TO service_role;
