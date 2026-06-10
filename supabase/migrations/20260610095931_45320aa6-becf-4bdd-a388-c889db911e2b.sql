
-- 1. Coupons: currency column
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'seed'
  CHECK (currency IN ('seed','usdt'));

-- 2. KYC documents table
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('passport','national_id','drivers_license')),
  document_path text NOT NULL,
  selfie_path text NOT NULL,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own kyc" ON public.kyc_documents;
CREATE POLICY "Owners read own kyc" ON public.kyc_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all kyc" ON public.kyc_documents;
CREATE POLICY "Admins read all kyc" ON public.kyc_documents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS kyc_documents_user_id_idx ON public.kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS kyc_documents_status_idx ON public.kyc_documents(status);

DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON public.kyc_documents;
CREATE TRIGGER update_kyc_documents_updated_at BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Username availability check
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE username = lower(trim(p_username))
      AND id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

-- 4. Replace admin_create_coupon with currency-aware version
DROP FUNCTION IF EXISTS public.admin_create_coupon(text, numeric, integer, timestamptz);
CREATE OR REPLACE FUNCTION public.admin_create_coupon(
  p_code text, p_amount numeric, p_max integer,
  p_currency text DEFAULT 'seed', p_expires timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_id uuid; v_code text := upper(trim(p_code));
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF v_code IS NULL OR length(v_code) = 0 THEN RAISE EXCEPTION 'Code required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_max IS NULL OR p_max < 1 THEN RAISE EXCEPTION 'Max redemptions must be >= 1'; END IF;
  IF p_currency NOT IN ('seed','usdt') THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  INSERT INTO public.coupons (code, amount, max_redemptions, currency, expires_at, active, created_by)
  VALUES (v_code, p_amount, p_max, p_currency, p_expires, true, v_admin)
  RETURNING id INTO v_id;
  PERFORM public.admin_audit(v_admin,'coupon_created','coupon',v_id,
    jsonb_build_object('code',v_code,'amount',p_amount,'max',p_max,'currency',p_currency));
  RETURN v_id;
END $$;

-- 5. Bulk coupon creation
CREATE OR REPLACE FUNCTION public.admin_create_coupons_bulk(
  p_count integer, p_amount numeric, p_max integer,
  p_currency text DEFAULT 'seed', p_prefix text DEFAULT NULL, p_expires timestamptz DEFAULT NULL
) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_codes text[] := ARRAY[]::text[];
  v_code text;
  v_prefix text := upper(coalesce(trim(p_prefix),''));
  i int;
  tries int;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN RAISE EXCEPTION 'Count out of range'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_max IS NULL OR p_max < 1 THEN RAISE EXCEPTION 'Max must be >= 1'; END IF;
  IF p_currency NOT IN ('seed','usdt') THEN RAISE EXCEPTION 'Invalid currency'; END IF;

  FOR i IN 1..p_count LOOP
    tries := 0;
    LOOP
      v_code := v_prefix || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = v_code);
      tries := tries + 1;
      IF tries > 10 THEN RAISE EXCEPTION 'Could not generate unique code'; END IF;
    END LOOP;
    INSERT INTO public.coupons (code, amount, max_redemptions, currency, expires_at, active, created_by)
    VALUES (v_code, p_amount, p_max, p_currency, p_expires, true, v_admin);
    v_codes := array_append(v_codes, v_code);
  END LOOP;

  PERFORM public.admin_audit(v_admin,'coupons_bulk_created','coupon',NULL,
    jsonb_build_object('count',p_count,'amount',p_amount,'currency',p_currency,'prefix',v_prefix));
  RETURN v_codes;
END $$;

-- 6. Booster CRUD
CREATE OR REPLACE FUNCTION public.admin_create_booster(
  p_code text, p_label text, p_duration_hours integer, p_reward_bps integer,
  p_cost_seed numeric, p_active boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  INSERT INTO public.boosters (code, label, duration_hours, reward_bps, cost_seed, active)
  VALUES (trim(p_code), trim(p_label), p_duration_hours, p_reward_bps, p_cost_seed, COALESCE(p_active,true))
  RETURNING id INTO v_id;
  PERFORM public.admin_audit(v_admin,'booster_created','booster',v_id,
    jsonb_build_object('code',p_code,'label',p_label));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_booster(
  p_id uuid, p_label text, p_duration_hours integer, p_reward_bps integer,
  p_cost_seed numeric, p_active boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.boosters
     SET label = trim(p_label),
         duration_hours = p_duration_hours,
         reward_bps = p_reward_bps,
         cost_seed = p_cost_seed,
         active = COALESCE(p_active, active),
         updated_at = now()
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booster not found'; END IF;
  PERFORM public.admin_audit(v_admin,'booster_updated','booster',p_id,'{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_booster_active(p_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.boosters SET active = COALESCE(p_active,false), updated_at = now() WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booster not found'; END IF;
  PERFORM public.admin_audit(v_admin, CASE WHEN p_active THEN 'booster_enabled' ELSE 'booster_disabled' END,'booster',p_id,'{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_booster(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  DELETE FROM public.boosters WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booster not found'; END IF;
  PERFORM public.admin_audit(v_admin,'booster_deleted','booster',p_id,'{}'::jsonb);
END $$;

-- 7. KYC submission + admin review
CREATE OR REPLACE FUNCTION public.kyc_submit(
  p_full_name text, p_document_type text, p_document_path text, p_selfie_path text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_document_type NOT IN ('passport','national_id','drivers_license') THEN
    RAISE EXCEPTION 'Invalid document type';
  END IF;
  INSERT INTO public.kyc_documents (user_id, full_name, document_type, document_path, selfie_path, status)
  VALUES (v_user, trim(p_full_name), p_document_type, p_document_path, p_selfie_path, 'pending')
  RETURNING id INTO v_id;
  UPDATE public.profiles SET kyc_status = 'pending', updated_at = now() WHERE id = v_user;
  PERFORM public.notify_user(v_user,'system','KYC submitted','We received your verification documents and will review them shortly.','kyc_documents',v_id);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_kyc(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_user uuid; v_new public.kyc_status;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  v_new := CASE WHEN p_approve THEN 'verified'::public.kyc_status ELSE 'rejected'::public.kyc_status END;
  UPDATE public.kyc_documents
     SET status = v_new, admin_note = NULLIF(trim(p_note),''),
         reviewed_by = v_admin, reviewed_at = now(), updated_at = now()
   WHERE id = p_id
   RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN RAISE EXCEPTION 'KYC submission not found'; END IF;
  UPDATE public.profiles SET kyc_status = v_new, updated_at = now() WHERE id = v_user;
  PERFORM public.notify_user(v_user,'system',
    CASE WHEN p_approve THEN 'KYC approved' ELSE 'KYC rejected' END,
    CASE WHEN p_approve THEN 'Your identity has been verified.' ELSE 'Your KYC submission was rejected.' || COALESCE(' Reason: ' || NULLIF(trim(p_note),''),'') END,
    'kyc_documents', p_id);
  PERFORM public.admin_audit(v_admin, CASE WHEN p_approve THEN 'kyc_approved' ELSE 'kyc_rejected' END,'kyc',p_id,
    jsonb_build_object('user_id',v_user,'note',p_note));
END $$;

-- 8. Storage policies for kyc bucket (bucket itself created via storage tool)
DROP POLICY IF EXISTS "Owners upload to kyc" ON storage.objects;
CREATE POLICY "Owners upload to kyc" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners read own kyc files" ON storage.objects;
CREATE POLICY "Owners read own kyc files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins read all kyc files" ON storage.objects;
CREATE POLICY "Admins read all kyc files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'kyc' AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
