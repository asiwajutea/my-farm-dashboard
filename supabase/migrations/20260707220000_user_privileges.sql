-- =========================================================
-- User Privilege System
-- Allows super admins to grant specific capabilities to users
-- without making them full admins.
--
-- Privileges:
--   bypass_maintenance   — bypass the maintenance gate on all pages
--   admin_farmers        — access /admin/farmers
--   admin_requests       — access /admin/requests (approve deposits/withdrawals)
--   admin_kyc            — access /admin/kyc
--   admin_cycles         — access /admin/cycles
--   admin_escrow         — access /admin/escrow
--   admin_coupons        — access /admin/coupons
--   admin_pv             — access /admin/pv
--   admin_audit          — access /admin/audit (read-only)
--   admin_deposit_channels — access /admin/deposit-channels
-- =========================================================

CREATE TABLE IF NOT EXISTS public.user_privileges (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  privilege    text        NOT NULL,
  granted_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note         text,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, privilege)
);

CREATE INDEX IF NOT EXISTS user_privileges_user_idx
  ON public.user_privileges (user_id);

GRANT SELECT ON public.user_privileges TO authenticated;
GRANT ALL    ON public.user_privileges TO service_role;

ALTER TABLE public.user_privileges ENABLE ROW LEVEL SECURITY;

-- Users can read their own privileges (so the client can check what they have)
DO $$ BEGIN
  CREATE POLICY "Users can view own privileges"
    ON public.user_privileges FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admins can read all privileges
DO $$ BEGIN
  CREATE POLICY "Admins can view all privileges"
    ON public.user_privileges FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only admins can insert/update/delete
DO $$ BEGIN
  CREATE POLICY "Admins manage privileges"
    ON public.user_privileges FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: check if a user has a specific privilege
CREATE OR REPLACE FUNCTION public.has_privilege(p_user_id uuid, p_privilege text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_privileges
    WHERE user_id = p_user_id AND privilege = p_privilege
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_privilege(uuid, text) TO authenticated;
