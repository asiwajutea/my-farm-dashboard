// Server-only helpers for the request service. The `.server.ts` suffix keeps
// this module (and its storage/env access) out of the client bundle. Import
// only from server function handlers.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  DEDUPE_WINDOW_MS,
  PROOF_MIME,
  proofExtension,
  type ProofMime,
} from "@/lib/requests.shared";

export type RequestScope = "deposits" | "withdrawals";

const PROOFS_BUCKET = "proofs";

/**
 * Upload a validated proof file to `proofs/{userId}/{scope}/{uuid}.{ext}` and
 * return the stored object path. Fails closed: returns null on any storage
 * error or unexpected MIME type so the caller can abort without inserting a
 * request row (Req 5.4, 8.2).
 */
export async function uploadProof(
  client: SupabaseClient<Database>,
  userId: string,
  scope: RequestScope,
  file: File,
): Promise<string | null> {
  const mime = file.type;
  if (!(PROOF_MIME as readonly string[]).includes(mime)) {
    return null;
  }
  const ext = proofExtension(mime as ProofMime);
  const path = `${userId}/${scope}/${crypto.randomUUID()}.${ext}`;

  const { error } = await client.storage
    .from(PROOFS_BUCKET)
    .upload(path, file, {
      contentType: mime,
      upsert: false,
    });

  if (error) {
    return null;
  }
  return path;
}

/**
 * Return an existing pending deposit row created by `userId` within
 * `windowMs` (default DEDUPE_WINDOW_MS) matching `(amount, method)`, else null.
 * Used to make deposit submission idempotent within the dedupe window (Req 5.8).
 */
export async function findRecentDuplicateDeposit(
  client: SupabaseClient<Database>,
  params: {
    userId: string;
    amount: string;
    method: string;
    windowMs?: number;
    now?: Date;
  },
): Promise<Database["public"]["Tables"]["deposit_requests"]["Row"] | null> {
  const windowMs = params.windowMs ?? DEDUPE_WINDOW_MS;
  const now = params.now ?? new Date();
  const since = new Date(now.getTime() - windowMs).toISOString();

  const { data, error } = await client
    .from("deposit_requests")
    .select("*")
    .eq("user_id", params.userId)
    .eq("method", params.method)
    .eq("amount", Number(params.amount))
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }
  return data[0];
}
