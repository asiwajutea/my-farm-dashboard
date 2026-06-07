
-- ============================================================
-- ROLES INFRASTRUCTURE
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Replace stub is_admin with real check
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(uid, 'admin'); $$;

-- ============================================================
-- BOOSTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.boosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  duration_hours integer NOT NULL CHECK (duration_hours > 0),
  reward_bps integer NOT NULL CHECK (reward_bps >= 0),
  cost_seed numeric(20,8) NOT NULL DEFAULT 0 CHECK (cost_seed >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.boosters TO authenticated;
GRANT ALL ON public.boosters TO service_role;
ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed-in can view active boosters" ON public.boosters;
CREATE POLICY "Anyone signed-in can view active boosters" ON public.boosters
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage boosters" ON public.boosters;
CREATE POLICY "Admins manage boosters" ON public.boosters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_boosters_updated_at ON public.boosters;
CREATE TRIGGER trg_boosters_updated_at BEFORE UPDATE ON public.boosters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.boosters (code, label, duration_hours, reward_bps, cost_seed) VALUES
  ('plan_1d', '1-Day Sprout',  24,  60,  0),
  ('plan_3d', '3-Day Bloom',   72,  220, 0),
  ('plan_5d', '5-Day Harvest', 120, 420, 0),
  ('plan_7d', '7-Day Bounty',  168, 650, 0)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- CYCLES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.cycle_status AS ENUM ('active', 'matured', 'reaped', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booster_id uuid REFERENCES public.boosters(id),
  amount numeric(20,8) NOT NULL CHECK (amount > 0),
  duration_hours integer NOT NULL CHECK (duration_hours > 0),
  reward_bps integer NOT NULL CHECK (reward_bps >= 0),
  status public.cycle_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  matures_at timestamptz NOT NULL,
  reaped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cycles_user_status_idx ON public.cycles (user_id, status);

GRANT SELECT, INSERT, UPDATE ON public.cycles TO authenticated;
GRANT ALL ON public.cycles TO service_role;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own cycles" ON public.cycles;
CREATE POLICY "Users view own cycles" ON public.cycles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own cycles" ON public.cycles;
CREATE POLICY "Users insert own cycles" ON public.cycles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update cycles" ON public.cycles;
CREATE POLICY "Admins update cycles" ON public.cycles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_cycles_updated_at ON public.cycles;
CREATE TRIGGER trg_cycles_updated_at BEFORE UPDATE ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- START / REAP FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_cycle(p_booster_id uuid, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_booster   public.boosters%ROWTYPE;
  v_wallet    public.wallets%ROWTYPE;
  v_cycle_id  uuid;
  v_settings  public.app_settings%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_booster FROM public.boosters WHERE id = p_booster_id AND active = true;
  IF v_booster.id IS NULL THEN RAISE EXCEPTION 'Booster not found or inactive'; END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = true;
  IF v_settings.id IS NOT NULL THEN
    IF p_amount < v_settings.min_cycle_seed THEN
      RAISE EXCEPTION 'Amount below minimum (% Seed)', v_settings.min_cycle_seed;
    END IF;
    IF p_amount > v_settings.max_cycle_seed THEN
      RAISE EXCEPTION 'Amount above maximum (% Seed)', v_settings.max_cycle_seed;
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'farming';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Farming wallet not found'; END IF;

  -- Debit farming wallet (locks itself via wallet_adjust)
  PERFORM public.wallet_adjust(v_wallet.id, -p_amount, 'cycle_start', 'Start cycle: ' || v_booster.label, 'cycles', NULL);

  INSERT INTO public.cycles (user_id, booster_id, amount, duration_hours, reward_bps, matures_at)
  VALUES (v_user, v_booster.id, p_amount, v_booster.duration_hours, v_booster.reward_bps,
          now() + make_interval(hours => v_booster.duration_hours))
  RETURNING id INTO v_cycle_id;

  RETURN v_cycle_id;
END $$;

CREATE OR REPLACE FUNCTION public.reap_cycle(p_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  IF v_cycle.status NOT IN ('active', 'matured') THEN RAISE EXCEPTION 'Cycle already %', v_cycle.status; END IF;
  IF v_cycle.matures_at > now() THEN RAISE EXCEPTION 'Cycle not yet matured'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND kind = 'farming';
  IF v_wallet.id IS NULL THEN RAISE EXCEPTION 'Farming wallet not found'; END IF;

  v_reward := round(v_cycle.amount * v_cycle.reward_bps / 10000.0, 8);

  PERFORM public.wallet_adjust(v_wallet.id, v_cycle.amount, 'cycle_reap_principal', 'Reap principal', 'cycles', v_cycle.id);
  IF v_reward > 0 THEN
    PERFORM public.wallet_adjust(v_wallet.id, v_reward, 'cycle_reap_reward', 'Reap reward', 'cycles', v_cycle.id);
  END IF;

  UPDATE public.cycles SET status = 'reaped', reaped_at = now() WHERE id = p_cycle_id;
END $$;

REVOKE ALL ON FUNCTION public.start_cycle(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_cycle(uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.reap_cycle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_cycle(uuid) TO authenticated;
