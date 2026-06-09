
DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM ('pending','accepted','released','cancelled','disputed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.escrow_trades (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         numeric(20,8) NOT NULL CHECK (amount > 0),
  title          text CHECK (title IS NULL OR char_length(title) <= 120),
  terms          text CHECK (terms IS NULL OR char_length(terms) <= 1000),
  status         public.escrow_status NOT NULL DEFAULT 'pending',
  dispute_reason text CHECK (dispute_reason IS NULL OR char_length(dispute_reason) <= 1000),
  resolution     text CHECK (resolution IS NULL OR char_length(resolution) <= 1000),
  resolved_by    uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (payer_id <> payee_id)
);

CREATE INDEX IF NOT EXISTS escrow_trades_payer_idx ON public.escrow_trades (payer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS escrow_trades_payee_idx ON public.escrow_trades (payee_id, created_at DESC);

GRANT SELECT ON public.escrow_trades TO authenticated;
GRANT ALL    ON public.escrow_trades TO service_role;

ALTER TABLE public.escrow_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view own escrows" ON public.escrow_trades;
CREATE POLICY "Participants view own escrows" ON public.escrow_trades
  FOR SELECT TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id OR public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS escrow_trades_updated_at ON public.escrow_trades;
CREATE TRIGGER escrow_trades_updated_at
  BEFORE UPDATE ON public.escrow_trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.escrow_create(p_payee_id uuid, p_amount numeric, p_title text DEFAULT NULL, p_terms text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payer uuid := auth.uid(); v_pw public.wallets%ROWTYPE; v_id uuid;
BEGIN
  IF v_payer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_payee_id IS NULL THEN RAISE EXCEPTION 'Counterparty required'; END IF;
  IF p_payee_id = v_payer THEN RAISE EXCEPTION 'Cannot open an escrow with yourself'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = p_payee_id AND kind = 'primary') THEN
    RAISE EXCEPTION 'Counterparty not found';
  END IF;
  SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_payer AND kind = 'primary' FOR UPDATE;
  IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;
  IF (v_pw.balance - v_pw.locked) < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.escrow_trades (payer_id, payee_id, amount, title, terms, status)
  VALUES (v_payer, p_payee_id, p_amount, NULLIF(trim(p_title), ''), NULLIF(trim(p_terms), ''), 'pending')
  RETURNING id INTO v_id;
  PERFORM public.wallet_adjust(v_pw.id, -p_amount, 'escrow_lock'::ledger_kind,
    'Escrow funded' || COALESCE(': ' || NULLIF(trim(p_title), ''), ''), 'escrow_trades', v_id);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.escrow_accept(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_e public.escrow_trades%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_e FROM public.escrow_trades WHERE id = p_id FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  IF v_e.payee_id <> v_user THEN RAISE EXCEPTION 'Only the counterparty can accept'; END IF;
  IF v_e.status <> 'pending' THEN RAISE EXCEPTION 'Escrow is not pending'; END IF;
  UPDATE public.escrow_trades SET status = 'accepted', updated_at = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.escrow_release(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_e public.escrow_trades%ROWTYPE; v_pw public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_e FROM public.escrow_trades WHERE id = p_id FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  IF v_e.payer_id <> v_user THEN RAISE EXCEPTION 'Only the payer can release'; END IF;
  IF v_e.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'Escrow cannot be released'; END IF;
  SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_e.payee_id AND kind = 'primary';
  IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Counterparty primary wallet not found'; END IF;
  UPDATE public.escrow_trades SET status = 'released', updated_at = now() WHERE id = p_id;
  PERFORM public.wallet_adjust(v_pw.id, v_e.amount, 'escrow_release'::ledger_kind, 'Escrow released', 'escrow_trades', v_e.id);
END $$;

CREATE OR REPLACE FUNCTION public.escrow_cancel(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_e public.escrow_trades%ROWTYPE; v_pw public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_e FROM public.escrow_trades WHERE id = p_id FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  IF v_user NOT IN (v_e.payer_id, v_e.payee_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_e.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending escrow can be cancelled'; END IF;
  SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_e.payer_id AND kind = 'primary';
  IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Payer primary wallet not found'; END IF;
  UPDATE public.escrow_trades SET status = 'cancelled', updated_at = now() WHERE id = p_id;
  PERFORM public.wallet_adjust(v_pw.id, v_e.amount, 'escrow_refund'::ledger_kind, 'Escrow cancelled - refund', 'escrow_trades', v_e.id);
END $$;

CREATE OR REPLACE FUNCTION public.escrow_dispute(p_id uuid, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_e public.escrow_trades%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_e FROM public.escrow_trades WHERE id = p_id FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  IF v_user NOT IN (v_e.payer_id, v_e.payee_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_e.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'Escrow cannot be disputed'; END IF;
  UPDATE public.escrow_trades SET status='disputed', dispute_reason=NULLIF(trim(p_reason),''), updated_at=now() WHERE id=p_id;
END $$;

CREATE OR REPLACE FUNCTION public.escrow_resolve(p_id uuid, p_release boolean, p_resolution text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_e public.escrow_trades%ROWTYPE; v_pw public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin(v_user) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v_e FROM public.escrow_trades WHERE id = p_id FOR UPDATE;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  IF v_e.status <> 'disputed' THEN RAISE EXCEPTION 'Escrow is not disputed'; END IF;
  IF p_release THEN
    SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_e.payee_id AND kind = 'primary';
    IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Counterparty primary wallet not found'; END IF;
    UPDATE public.escrow_trades SET status='released', resolution=NULLIF(trim(p_resolution),''), resolved_by=v_user, updated_at=now() WHERE id=p_id;
    PERFORM public.wallet_adjust(v_pw.id, v_e.amount, 'escrow_release'::ledger_kind, 'Escrow released by admin', 'escrow_trades', v_e.id);
  ELSE
    SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_e.payer_id AND kind = 'primary';
    IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Payer primary wallet not found'; END IF;
    UPDATE public.escrow_trades SET status='refunded', resolution=NULLIF(trim(p_resolution),''), resolved_by=v_user, updated_at=now() WHERE id=p_id;
    PERFORM public.wallet_adjust(v_pw.id, v_e.amount, 'escrow_refund'::ledger_kind, 'Escrow refunded by admin', 'escrow_trades', v_e.id);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.escrow_create(uuid, numeric, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.escrow_accept(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.escrow_release(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.escrow_cancel(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.escrow_dispute(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.escrow_resolve(uuid, boolean, text) TO authenticated, service_role;
