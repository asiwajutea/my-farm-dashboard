
CREATE OR REPLACE FUNCTION public.transfer_to_farming(p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pw   public.wallets%ROWTYPE;
  v_fw   public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_pw FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_pw.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  SELECT * INTO v_fw FROM public.wallets WHERE user_id = v_user AND kind = 'farming';
  IF v_fw.id IS NULL THEN
    INSERT INTO public.wallets (user_id, kind, balance, locked)
    VALUES (v_user, 'farming', 0, 0)
    RETURNING * INTO v_fw;
  END IF;

  IF (v_pw.balance - v_pw.locked) < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  PERFORM public.wallet_transfer(
    v_pw.id, v_fw.id, p_amount,
    'transfer_out'::ledger_kind, 'transfer_in'::ledger_kind,
    'Transfer to farming wallet', NULL, NULL
  );
END $$;

GRANT EXECUTE ON FUNCTION public.transfer_to_farming(numeric) TO authenticated;
