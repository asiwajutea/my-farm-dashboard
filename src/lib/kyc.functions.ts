import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { uploadKycFile } from "@/lib/kyc.server";
import {
  isKycDocumentType,
  validateKycFile,
  KYC_NAME_MIN,
  KYC_NAME_MAX,
  type KycStatus,
} from "@/lib/kyc.shared";

export class KycError extends Error {}

export type MyKycSubmission = {
  id: string;
  full_name: string;
  document_type: string;
  status: KycStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type MyKycState = {
  status: KycStatus;
  latest: MyKycSubmission | null;
};

// Current KYC status for the signed-in Farmer + their latest submission (if
// any), used to drive the /verify page.
export const getMyKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyKycState> => {
    const supabase = context.supabase as SupabaseClient<Database>;
    const userId = context.userId as string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("kyc_status")
      .eq("id", userId)
      .maybeSingle();

    const { data: rows } = await supabase
      .from("kyc_documents")
      .select("id, full_name, document_type, status, admin_note, created_at, reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = (rows?.[0] as MyKycSubmission | undefined) ?? null;
    return {
      status: (profile?.kyc_status as KycStatus | undefined) ?? "unverified",
      latest,
    };
  });

// Submit a KYC application: validates inputs, uploads the document + selfie to
// the private `kyc` bucket, then records the submission via the kyc_submit RPC
// (which flips the profile to 'pending'). Accepts multipart FormData.
export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((fd: FormData) => fd)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const supabase = context.supabase as SupabaseClient<Database>;
    const userId = context.userId as string;

    // a. full name
    const fullName = String(data.get("full_name") ?? "").trim();
    if (fullName.length < KYC_NAME_MIN || fullName.length > KYC_NAME_MAX) {
      throw new KycError("Please enter your full legal name.");
    }

    // b. document type
    const documentType = data.get("document_type");
    if (!isKycDocumentType(documentType)) {
      throw new KycError("Please choose a valid document type.");
    }

    // c. files
    const rawDoc = data.get("document");
    const rawSelfie = data.get("selfie");
    const docFile = rawDoc instanceof File && rawDoc.size > 0 ? rawDoc : null;
    const selfieFile = rawSelfie instanceof File && rawSelfie.size > 0 ? rawSelfie : null;

    const docCheck = validateKycFile(docFile ? { type: docFile.type, size: docFile.size } : null);
    if (!docCheck.ok) {
      throw new KycError(
        docCheck.code === "missing"
          ? "Please attach a photo of your document."
          : "Document must be a JPG, PNG, or PDF under 10 MB.",
      );
    }
    const selfieCheck = validateKycFile(
      selfieFile ? { type: selfieFile.type, size: selfieFile.size } : null,
    );
    if (!selfieCheck.ok) {
      throw new KycError(
        selfieCheck.code === "missing"
          ? "Please attach a selfie."
          : "Selfie must be a JPG, PNG, or PDF under 10 MB.",
      );
    }

    // d. upload both files; fail closed
    const documentPath = await uploadKycFile(supabase, userId, "document", docFile!);
    if (!documentPath) throw new KycError("Could not upload your document. Please try again.");
    const selfiePath = await uploadKycFile(supabase, userId, "selfie", selfieFile!);
    if (!selfiePath) throw new KycError("Could not upload your selfie. Please try again.");

    // e. record submission (also sets profiles.kyc_status = 'pending')
    const { data: id, error } = await supabase.rpc("kyc_submit", {
      p_full_name: fullName,
      p_document_type: documentType,
      p_document_path: documentPath,
      p_selfie_path: selfiePath,
    });
    if (error) throw new KycError(error.message);
    return { id: String(id) };
  });
