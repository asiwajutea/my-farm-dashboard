
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('bank','crypto')),
  label text NOT NULL,
  -- bank fields
  bank_name text,
  account_name text,
  account_number text,
  routing_number text,
  iban text,
  swift text,
  -- crypto fields
  network text,        -- e.g. TRC20, ERC20, BEP20, SOL
  address text,
  memo text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_methods_user ON public.payout_methods(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;

ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own payout methods select" ON public.payout_methods;
CREATE POLICY "own payout methods select" ON public.payout_methods
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own payout methods insert" ON public.payout_methods;
CREATE POLICY "own payout methods insert" ON public.payout_methods
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own payout methods update" ON public.payout_methods;
CREATE POLICY "own payout methods update" ON public.payout_methods
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own payout methods delete" ON public.payout_methods;
CREATE POLICY "own payout methods delete" ON public.payout_methods
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_payout_methods_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS payout_methods_updated_at ON public.payout_methods;
CREATE TRIGGER payout_methods_updated_at BEFORE UPDATE ON public.payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.tg_payout_methods_updated_at();

-- Ensure only one default per (user, kind)
CREATE OR REPLACE FUNCTION public.tg_payout_methods_single_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.payout_methods
       SET is_default = false
     WHERE user_id = NEW.user_id AND kind = NEW.kind AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payout_methods_single_default ON public.payout_methods;
CREATE TRIGGER payout_methods_single_default AFTER INSERT OR UPDATE OF is_default ON public.payout_methods
  FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.tg_payout_methods_single_default();
