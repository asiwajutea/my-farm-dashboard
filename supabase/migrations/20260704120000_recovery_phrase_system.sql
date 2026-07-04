-- =========================================================
-- Recovery Phrase System
-- Adds the recovery_phrases and recovery_phrase_attempts
-- tables with RLS, and a PostgreSQL function to issue a
-- Supabase password-reset link for a verified user.
-- =========================================================

-- 1. recovery_phrases — stores one bcrypt hash per user --------------------
CREATE TABLE IF NOT EXISTS public.recovery_phrases (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phrase_hash  text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Only one phrase record per user
CREATE UNIQUE INDEX IF NOT EXISTS recovery_phrases_user_id_idx
  ON public.recovery_phrases (user_id);

GRANT SELECT, INSERT, UPDATE ON public.recovery_phrases TO authenticated;
GRANT ALL ON public.recovery_phrases TO service_role;

ALTER TABLE public.recovery_phrases ENABLE ROW LEVEL SECURITY;

-- Users can read their own row (to know whether a phrase is set)
DO $$ BEGIN
  CREATE POLICY "Users can view own recovery phrase"
    ON public.recovery_phrases FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Anon is blocked entirely (verify happens via SECURITY DEFINER fn)
DO $$ BEGIN
  CREATE POLICY "Anon blocked from recovery phrases"
    ON public.recovery_phrases AS RESTRICTIVE FOR ALL TO anon
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep updated_at current
DROP TRIGGER IF EXISTS recovery_phrases_updated_at ON public.recovery_phrases;
CREATE TRIGGER recovery_phrases_updated_at
  BEFORE UPDATE ON public.recovery_phrases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. recovery_phrase_attempts — rate-limit table ---------------------------
CREATE TABLE IF NOT EXISTS public.recovery_phrase_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash      text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_phrase_attempts_user_idx
  ON public.recovery_phrase_attempts (user_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS recovery_phrase_attempts_ip_idx
  ON public.recovery_phrase_attempts (ip_hash, attempted_at DESC);

GRANT ALL ON public.recovery_phrase_attempts TO service_role;

ALTER TABLE public.recovery_phrase_attempts ENABLE ROW LEVEL SECURITY;

-- Only service_role touches this table (via SECURITY DEFINER fns)
DO $$ BEGIN
  CREATE POLICY "No direct access to attempts"
    ON public.recovery_phrase_attempts AS RESTRICTIVE FOR ALL TO authenticated
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. profiles — add has_recovery_phrase flag for fast UI checks ------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_recovery_phrase boolean NOT NULL DEFAULT false;
