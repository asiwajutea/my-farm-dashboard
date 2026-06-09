// Server-only KYC helpers. The `.server.ts` suffix keeps storage/env access out
// of the client bundle. Import only from server function handlers.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { KYC_FILE_MIME, kycFileExtension, type KycFileMime } from "@/lib/kyc.shared";

export const KYC_BUCKET = "kyc";

export type KycUploadKind = "document" | "selfie";

/**
 * Upload a validated KYC file to `kyc/{userId}/{kind}/{uuid}.{ext}` and return
 * the stored object path. Fails closed: returns null on any storage error or
 * unexpected MIME type so the caller aborts before recording a submission.
 */
export async function uploadKycFile(
  client: SupabaseClient<Database>,
  userId: string,
  kind: KycUploadKind,
  file: File,
): Promise<string | null> {
  const mime = file.type;
  if (!(KYC_FILE_MIME as readonly string[]).includes(mime)) {
    return null;
  }
  const ext = kycFileExtension(mime as KycFileMime);
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${ext}`;

  const { error } = await client.storage.from(KYC_BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (error) return null;
  return path;
}
