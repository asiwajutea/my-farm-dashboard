
-- 1) app_settings: add affiliate config
DO $$ BEGIN
  CREATE TYPE public.aff_basis AS ENUM ('profit','profit_plus_capital');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_source AS ENUM ('cycle','maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_status AS ENUM ('due','paid','waived','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS aff_gen1_pct numeric(6,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS aff_gen2_pct numeric(6,4) NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS aff_gen3_pct numeric(6,4) NOT NULL DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS aff_basis public.aff_basis NOT NULL DEFAULT 'profit',
  ADD COLUMN IF NOT EXISTS maint_fee_seed numeric(20,8) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS maint_fee_day int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aff_maint_gen1_pct numeric(6,4) NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS aff_maint_gen2_pct numeric(6,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS aff_maint_gen3_pct numeric(6,4) NOT NULL DEFAULT 0.02;

-- 2) Extend ledger_kind enum
DO $$ BEGIN
  ALTER TYPE public.ledger_kind ADD VALUE IF NOT EXISTS 'affiliate_commission';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.ledger_kind ADD VALUE IF NOT EXISTS 'maintenance_fee';
EXCEPTION WHEN others THEN NULL; END $$;

-- 3) affiliate_commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation int NOT NULL CHECK (generation BETWEEN 1 AND 3),
  source public.affiliate_source NOT NULL,
  source_id uuid,
  basis_amount numeric(20,8) NOT NULL,
  pct numeric(6,4) NOT NULL,
  amount numeric(20,8) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_comm_user ON public.affiliate_commissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_comm_from ON public.affiliate_commissions(from_user_id);

GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners see own commissions"
  ON public.affiliate_commissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = from_user_id OR public.has_role(auth.uid(),'admin'));

-- 4) maintenance_fees
CREATE TABLE IF NOT EXISTS public.maintenance_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(20,8) NOT NULL,
  status public.maintenance_status NOT NULL DEFAULT 'due',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_maint_user ON public.maintenance_fees(user_id, period_start DESC);

GRANT SELECT, UPDATE ON public.maintenance_fees TO authenticated;
GRANT ALL ON public.maintenance_fees TO service_role;
ALTER TABLE public.maintenance_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own fees"
  ON public.maintenance_fees FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage fees"
  ON public.maintenance_fees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER maintenance_fees_updated_at
  BEFORE UPDATE ON public.maintenance_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) get_uplines helper
CREATE OR REPLACE FUNCTION public.get_uplines(_user_id uuid)
RETURNS TABLE(user_id uuid, generation int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cur uuid;
  v_next uuid;
  v_gen int := 0;
BEGIN
  SELECT referred_by INTO v_cur FROM public.profiles WHERE id = _user_id;
  WHILE v_cur IS NOT NULL AND v_gen < 3 LOOP
    v_gen := v_gen + 1;
    user_id := v_cur;
    generation := v_gen;
    RETURN NEXT;
    SELECT referred_by INTO v_next FROM public.profiles WHERE id = v_cur;
    v_cur := v_next;
  END LOOP;
END $$;

-- 6) lookup_referrer (public-readable)
CREATE OR REPLACE FUNCTION public.lookup_referrer(_code text)
RETURNS TABLE(id uuid, display_name text, username text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.avatar_url
  FROM public.profiles p
  WHERE p.referral_code = upper(trim(_code))
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_referrer(text) TO anon, authenticated;

-- 7) pay_cycle_commissions
CREATE OR REPLACE FUNCTION public.pay_cycle_commissions(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cycle    public.cycles%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_reward   numeric(20,8);
  v_basis    numeric(20,8);
  v_upline   record;
  v_pct      numeric(6,4);
  v_amount   numeric(20,8);
  v_wallet   public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_cycle FROM public.cycles WHERE id = p_cycle_id;
  IF v_cycle.id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NULL THEN RETURN; END IF;

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
    v_amount := round(v_basis * v_pct, 8);
    IF v_amount <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_upline.user_id AND kind = 'primary';
    IF v_wallet.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.affiliate_commissions(user_id, from_user_id, generation, source, source_id, basis_amount, pct, amount)
      VALUES (v_upline.user_id, v_cycle.user_id, v_upline.generation, 'cycle', v_cycle.id, v_basis, v_pct, v_amount);

    PERFORM public.wallet_adjust(v_wallet.id, v_amount, 'affiliate_commission'::ledger_kind,
      'Gen ' || v_upline.generation || ' cycle commission', 'cycles', v_cycle.id);
  END LOOP;
END $$;

-- 8) Override reap_cycle to also pay commissions
CREATE OR REPLACE FUNCTION public.reap_cycle(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_cycle   public.cycles%ROWTYPE;
  v_wallet  public.wallets%ROWTYPE;
  v_reward  numeric(20,8);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_cycle FROM public.cycles WHERE id = p_cycle_id FOR UPDATE;
  IF v_cycle.id IS NULL THEN RAISE EXCEPTION 'Cycle not found'; END IF;
  IF v_cycle.user_id <> v_user THEN RAISE EXCEPTION 'Not your cycle'; END IF;
  IF v_cycle.status NOT IN ('active','matured') THEN RAISE EXCEPTION 'Cycle already %', v_cycle.status; END IF;
  IF v_cycle.matures_at > now() THEN RAISE EXCEPTION 'Cycle not yet matured'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'farming';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Farming wallet not found'; END IF;

  v_reward := round(v_cycle.amount * v_cycle.reward_bps / 10000.0, 8);

  PERFORM public.wallet_adjust(v_wallet.id, v_cycle.amount, 'cycle_reap_principal', 'Reap principal', 'cycles', v_cycle.id);
  IF v_reward > 0 THEN
    PERFORM public.wallet_adjust(v_wallet.id, v_reward, 'cycle_reap_reward', 'Reap reward', 'cycles', v_cycle.id);
  END IF;

  UPDATE public.cycles SET status='reaped', reaped_at=now() WHERE id = p_cycle_id;

  PERFORM public.pay_cycle_commissions(p_cycle_id);
END $$;

-- 9) pay_maintenance_fee
CREATE OR REPLACE FUNCTION public.pay_maintenance_fee(p_fee_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_fee     public.maintenance_fees%ROWTYPE;
  v_wallet  public.wallets%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_upline  record;
  v_pct     numeric(6,4);
  v_amount  numeric(20,8);
  v_uwallet public.wallets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_fee FROM public.maintenance_fees WHERE id = p_fee_id FOR UPDATE;
  IF v_fee.id IS NULL THEN RAISE EXCEPTION 'Fee not found'; END IF;
  IF v_fee.user_id <> v_user THEN RAISE EXCEPTION 'Not your fee'; END IF;
  IF v_fee.status = 'paid' THEN RAISE EXCEPTION 'Already paid'; END IF;
  IF v_fee.status = 'waived' THEN RAISE EXCEPTION 'Fee waived'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'primary';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Primary wallet not found'; END IF;

  PERFORM public.wallet_adjust(v_wallet.id, -v_fee.amount, 'maintenance_fee'::ledger_kind,
    'Maintenance fee ' || to_char(v_fee.period_start, 'YYYY-MM'), 'maintenance_fees', v_fee.id);

  UPDATE public.maintenance_fees SET status='paid', paid_at=now() WHERE id = p_fee_id;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  FOR v_upline IN SELECT * FROM public.get_uplines(v_user) LOOP
    v_pct := CASE v_upline.generation
      WHEN 1 THEN v_settings.aff_maint_gen1_pct
      WHEN 2 THEN v_settings.aff_maint_gen2_pct
      WHEN 3 THEN v_settings.aff_maint_gen3_pct
    END;
    IF v_pct IS NULL OR v_pct <= 0 THEN CONTINUE; END IF;
    v_amount := round(v_fee.amount * v_pct, 8);
    IF v_amount <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_uwallet FROM public.wallets WHERE user_id = v_upline.user_id AND kind = 'primary';
    IF v_uwallet.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.affiliate_commissions(user_id, from_user_id, generation, source, source_id, basis_amount, pct, amount)
      VALUES (v_upline.user_id, v_user, v_upline.generation, 'maintenance', v_fee.id, v_fee.amount, v_pct, v_amount);

    PERFORM public.wallet_adjust(v_uwallet.id, v_amount, 'affiliate_commission'::ledger_kind,
      'Gen ' || v_upline.generation || ' maintenance commission', 'maintenance_fees', v_fee.id);
  END LOOP;
END $$;

-- 10) admin_run_monthly_maintenance
CREATE OR REPLACE FUNCTION public.admin_run_monthly_maintenance()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_settings public.app_settings%ROWTYPE;
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  v_count int := 0;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;

  INSERT INTO public.maintenance_fees(user_id, period_start, period_end, amount)
  SELECT p.id, v_period_start, v_period_end, v_settings.maint_fee_seed
  FROM public.profiles p
  ON CONFLICT (user_id, period_start) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- 11) Updated signup trigger to handle referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref_code text;
  v_ref_id   uuid;
BEGIN
  v_ref_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF length(v_ref_code) > 0 THEN
    SELECT id INTO v_ref_id FROM public.profiles WHERE referral_code = v_ref_code;
    IF v_ref_id = NEW.id THEN v_ref_id := NULL; END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_referral_code(),
    v_ref_id
  );

  INSERT INTO public.wallets (user_id, kind) VALUES (NEW.id, 'primary'), (NEW.id, 'farming')
  ON CONFLICT (user_id, kind) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farmer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $$;
