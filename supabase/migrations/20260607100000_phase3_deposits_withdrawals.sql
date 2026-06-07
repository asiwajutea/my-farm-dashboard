-- =========================================================
-- Phase 3: Deposit & Withdrawal requests + proofs bucket
-- Tables + grants + RLS + policies + storage all in ONE file
-- (follows the convention of 20260607004431).
-- =========================================================

-- 1. Status enum (Req 2.3) --------------------------------------------------

CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. Request tables (Req 2.1, 2.2, 2.4, 2.5, 2.6) ---------------------------

CREATE TABLE public.deposit_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(20, 8) NOT NULL CHECK (amount > 0),               -- Req 2.6
  method      text NOT NULL CHECK (char_length(method) <= 50),
  status      public.request_status NOT NULL DEFAULT 'pending',         -- Req 2.4
  admin_note  text CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  proof_url   text CHECK (proof_url  IS NULL OR char_length(proof_url)  <= 2048),
  created_at  timestamptz NOT NULL DEFAULT now(),                       -- Req 2.5
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- withdrawal_requests mirrors deposit_requests exactly (Req 2.2).
-- LIKE ... INCLUDING ALL copies columns, defaults, checks, and the PK; the
-- FK to auth.users is NOT copied by LIKE, so it is re-added explicitly below.
-- (No paging index exists on deposit_requests yet at this point, so none is
-- inherited; both paging indexes are created explicitly afterwards.)
CREATE TABLE public.withdrawal_requests (LIKE public.deposit_requests INCLUDING ALL);

ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Paging indexes for own-request history (Req 7.1, 7.5).
CREATE INDEX deposit_requests_user_created_idx
  ON public.deposit_requests (user_id, created_at DESC, id DESC);
CREATE INDEX withdrawal_requests_user_created_idx
  ON public.withdrawal_requests (user_id, created_at DESC, id DESC);

-- 3. Grants — authenticated + service_role, NO anon (Req 3.1, 3.2, 3.3) -----

GRANT SELECT, INSERT ON public.deposit_requests    TO authenticated;
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.deposit_requests    TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;

-- 4. RLS — enable + own-row policies, same migration (Req 4.1, 4.2) ---------

ALTER TABLE public.deposit_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers read own deposit requests"
  ON public.deposit_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);                                         -- Req 4.3, 4.5

CREATE POLICY "Farmers insert own deposit requests"
  ON public.deposit_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);                                    -- Req 4.4, 4.5

CREATE POLICY "Farmers read own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Farmers insert own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. updated_at triggers (reuse existing public.update_updated_at_column()) --

CREATE TRIGGER deposit_requests_updated_at
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Private proofs bucket (Req 8.1) ----------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Admin shim (Req 8.5) ---------------------------------------------------
-- Forward-compatible: returns false until Phase 7 swaps in has_role(uid,'admin').
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
AS $$
  SELECT false;   -- Phase 7 replaces body with has_role(uid, 'admin')
$$;

-- 8. Storage policies for the proofs bucket (Req 8.2, 8.3, 8.4, 8.5, 8.6) ---
-- Object paths are uid-prefixed: the first folder segment must equal the
-- caller's uid. No anon policy exists, so unauthenticated access is denied
-- by default (Req 8.6).

CREATE POLICY "proofs owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text               -- Req 8.2, 8.3
  );

CREATE POLICY "proofs owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text               -- Req 8.4
  );

CREATE POLICY "proofs admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proofs'
    AND public.is_admin(auth.uid())                                    -- Req 8.5 (shim => false today)
  );
