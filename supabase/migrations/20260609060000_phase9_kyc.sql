-- =========================================================
-- Phase 9: Compliance & Trust — KYC identity verification
-- One file: private storage bucket + policies, kyc_documents table + RLS,
-- submit RPC (sets profiles.kyc_status='pending'), admin review RPC
-- (sets verified/rejected + audit), and a notification on status change.
--
-- Mirrors the Phase 3 `proofs` bucket convention (uid-prefixed object paths)
-- and the Phase 7 admin-RPC convention (SECURITY DEFINER + is_admin() guard +
-- admin_audit()). Document files are private; admins read via signed URLs.
-- =========================================================

-- 1. Private KYC bucket -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

-- Object paths are uid-prefixed: first folder segment must equal the caller's
-- uid. No anon policy => unauthenticated access denied by default.
CREATE POLICY "kyc owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc'
    AND public.is_admin(auth.uid())
  );

-- 2. kyc_documents table ----------------------------------------------------
-- One row per submission attempt. The latest row per user is the "current"
-- submission; historical rows are retained for the audit trail.
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  document_type text NOT NULL CHECK (document_type IN ('passport','national_id','drivers_license')),
  document_path text NOT NULL,
  selfie_path   text NOT NULL,
  status        public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note    text CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  reviewed_by   uuid REFERENCES auth.users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kyc_documents_user_idx ON public.kyc_documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kyc_documents_status_idx ON public.kyc_documents (status, created_at DESC);

GRANT SELECT ON public.kyc_documents TO authenticated;
GRANT ALL    ON public.kyc_documents TO service_role;

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- Owners read their own submissions; admins read all. Inserts/updates happen
-- only through the SECURITY DEFINER RPCs below, never directly from clients.
CREATE POLICY "Users read own kyc documents" ON public.kyc_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kyc_documents_updated_at
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RPC: kyc_submit --------------------------------------------------------
-- Called by the Farmer after their document + selfie are uploaded to the kyc
-- bucket. Records the submission and flips the profile to 'pending'. Blocked
-- if the Farmer is already verified or has a pending submission.
CREATE OR REPLACE FUNCTION public.kyc_submit(
  p_full_name     text,
  p_document_type text,
  p_document_path text,
  p_selfie_path   text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cur  public.kyc_status;
  v_id   uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_full_name IS NULL OR char_length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF p_document_type NOT IN ('passport','national_id','drivers_license') THEN
    RAISE EXCEPTION 'Invalid document type';
  END IF;
  IF p_document_path IS NULL OR p_selfie_path IS NULL THEN
    RAISE EXCEPTION 'Document and selfie are required';
  END IF;

  -- Defensive: uploaded objects must live under the caller's own folder.
  IF split_part(p_document_path, '/', 1) <> v_user::text
     OR split_part(p_selfie_path, '/', 1) <> v_user::text THEN
    RAISE EXCEPTION 'Invalid upload path';
  END IF;

  SELECT kyc_status INTO v_cur FROM public.profiles WHERE id = v_user;
  IF v_cur = 'verified' THEN RAISE EXCEPTION 'Already verified'; END IF;
  IF v_cur = 'pending' THEN RAISE EXCEPTION 'A verification is already under review'; END IF;

  INSERT INTO public.kyc_documents (user_id, full_name, document_type, document_path, selfie_path, status)
  VALUES (v_user, trim(p_full_name), p_document_type, p_document_path, p_selfie_path, 'pending')
  RETURNING id INTO v_id;

  UPDATE public.profiles SET kyc_status = 'pending', updated_at = now() WHERE id = v_user;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.kyc_submit(text, text, text, text) TO authenticated;

-- 4. RPC: admin_review_kyc --------------------------------------------------
-- Admin approves or rejects a KYC submission. Updates both the document row and
-- the profile's kyc_status, and writes an audit entry. Idempotent on rows that
-- are no longer pending.
CREATE OR REPLACE FUNCTION public.admin_review_kyc(
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
  v_admin  uuid := auth.uid();
  v_user   uuid;
  v_status public.kyc_status;
  v_new    public.kyc_status;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT user_id, status INTO v_user, v_status
    FROM public.kyc_documents WHERE id = p_id FOR UPDATE;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Submission already %', v_status; END IF;

  v_new := CASE WHEN p_approve THEN 'verified'::public.kyc_status ELSE 'rejected'::public.kyc_status END;

  UPDATE public.kyc_documents
     SET status = v_new,
         admin_note = NULLIF(trim(p_note), ''),
         reviewed_by = v_admin,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_id;

  UPDATE public.profiles SET kyc_status = v_new, updated_at = now() WHERE id = v_user;

  PERFORM public.admin_audit(
    v_admin,
    CASE WHEN p_approve THEN 'kyc_approved' ELSE 'kyc_rejected' END,
    'kyc_document', p_id,
    jsonb_build_object('user_id', v_user, 'note', p_note)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.admin_review_kyc(uuid, boolean, text) TO authenticated, service_role;

-- 5. Notify the Farmer when their KYC decision lands (optional) ------------
-- The notifications subsystem (Phase 8) may or may not be present yet. To keep
-- this migration self-contained and order-independent, only wire up the
-- notification trigger when that infrastructure exists. If Phase 8 lands later,
-- its own migration ordering still precedes this one; this guard simply makes
-- Phase 9 safe to apply on its own.
DO $$
BEGIN
  IF to_regprocedure('public.notify_user(uuid, public.notification_kind, text, text, text, uuid)') IS NOT NULL THEN
    -- Add KYC kinds to the enum (no-op if already present).
    BEGIN
      ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'kyc_approved';
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'kyc_rejected';
    EXCEPTION WHEN others THEN NULL; END;

    -- Trigger fn references the enum values via dynamic SQL so this migration
    -- compiles even when the new enum labels were added in the same run.
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.tg_notify_kyc()
      RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
      AS $body$
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
          IF NEW.status = 'verified' THEN
            PERFORM public.notify_user(NEW.user_id, 'kyc_approved'::public.notification_kind,
              'Identity verified',
              'Your identity verification was approved. Full platform access is unlocked.',
              'kyc_documents', NEW.id);
          ELSIF NEW.status = 'rejected' THEN
            PERFORM public.notify_user(NEW.user_id, 'kyc_rejected'::public.notification_kind,
              'Verification rejected',
              'Your identity verification was not approved.'
                || COALESCE(' Note: ' || NULLIF(trim(NEW.admin_note), ''), '')
                || ' You can submit again.',
              'kyc_documents', NEW.id);
          END IF;
        END IF;
        RETURN NEW;
      END $body$;
    $fn$;

    DROP TRIGGER IF EXISTS notify_kyc ON public.kyc_documents;
    CREATE TRIGGER notify_kyc
      AFTER UPDATE ON public.kyc_documents
      FOR EACH ROW EXECUTE FUNCTION public.tg_notify_kyc();
  END IF;
END $$;
