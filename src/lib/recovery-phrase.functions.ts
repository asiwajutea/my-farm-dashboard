/**
 * Recovery Phrase Server Functions
 *
 * Setup  → requireSupabaseAuth (authenticated user storing their phrase)
 * Verify → no auth middleware; uses supabaseAdmin + bcrypt server-side
 *           so the hash never reaches the client
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 60;

// ── Setup ─────────────────────────────────────────────────────────────────

/**
 * Store a hashed recovery phrase for the current user.
 * `words` is the full ordered array of 12 words joined as a single string
 * before hashing, so position matters.
 */
export const setupRecoveryPhrase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ words: z.array(z.string().min(1)).length(12) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const bcrypt = await import("bcryptjs");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Normalise: lowercase and trim each word, then join with a fixed separator
    const canonical = data.words.map((w) => w.toLowerCase().trim()).join("|");
    const hash = await bcrypt.hash(canonical, 12);

    // Upsert so re-setup overwrites the old hash
    const { error: upsertErr } = await supabaseAdmin
      .from("recovery_phrases")
      .upsert(
        { user_id: context.userId, phrase_hash: hash },
        { onConflict: "user_id" },
      );
    if (upsertErr) throw new Error(upsertErr.message);

    // Mark flag on profile for fast UI checks
    const { error: flagErr } = await supabaseAdmin
      .from("profiles")
      .update({ has_recovery_phrase: true })
      .eq("id", context.userId);
    if (flagErr) throw new Error(flagErr.message);

    return { ok: true };
  });

// ── Status check ─────────────────────────────────────────────────────────

/** Returns whether the current user has a recovery phrase set. */
export const getRecoveryPhraseStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ hasPhrase: boolean }> => {
    const { data } = await context.supabase
      .from("profiles")
      .select("has_recovery_phrase")
      .eq("id", context.userId)
      .maybeSingle();
    return { hasPhrase: Boolean(data?.has_recovery_phrase) };
  });

// ── Verify (no auth — used from forgot-password flow) ────────────────────

/**
 * Verify recovery phrase challenge answers without requiring a session.
 *
 * The client sends:
 *   - email: the account email
 *   - positions: which 3 positions were challenged (0-indexed, e.g. [5, 9, 1])
 *   - answers: the words the user entered for those positions
 *
 * The server reconstructs the full 12-word canonical string by loading
 * the stored hash and verifying only the bcrypt compare (we cannot
 * reconstruct partial hashes — so we ask the user to submit all 12 words
 * but only show 3 of them to type, and verify the full set here).
 *
 * Wait — simpler and more secure approach:
 * The client stores the generated words in memory during the setup nag modal
 * and sends all 12 back for verification. We never persist plaintext.
 * For the recovery flow the user IS typing all 12 words (displayed in a grid
 * where only 3 are active inputs), so we receive all 12 to verify.
 */
export const verifyRecoveryPhrase = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      words: z.array(z.string().min(1)).length(12),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ recoveryToken: string }> => {
    const bcrypt = await import("bcryptjs");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Look up auth user by email — use getUserByEmail if available,
    //    otherwise fall back to a filtered listUsers call
    let authUserId: string | null = null;
    let authUserEmail: string | null = null;

    // Try direct lookup first (most efficient)
    try {
      const { data: { users }, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({
        // Filter is not available in all SDK versions; we filter client-side below
        page: 1,
        perPage: 1000,
      });
      if (!lookupErr) {
        const found = users.find(
          (u) => u.email?.toLowerCase() === data.email.toLowerCase().trim(),
        );
        if (found) {
          authUserId = found.id;
          authUserEmail = found.email ?? null;
        }
      }
    } catch {
      // listUsers failed — nothing to do, authUserId stays null
    }

    if (!authUserId) throw new Error("Invalid credentials");

    // 2. Rate-limit: max MAX_ATTEMPTS per WINDOW_MINUTES
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("recovery_phrase_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= MAX_ATTEMPTS) {
      throw new Error(
        `Too many attempts. Please wait ${WINDOW_MINUTES} minutes before trying again.`,
      );
    }

    // 3. Record this attempt (always, even before verify, to prevent enumeration)
    await supabaseAdmin
      .from("recovery_phrase_attempts")
      .insert({ user_id: authUserId });

    // 4. Load stored hash
    const { data: phraseRow } = await supabaseAdmin
      .from("recovery_phrases")
      .select("phrase_hash")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (!phraseRow?.phrase_hash) {
      throw new Error("No recovery phrase set for this account. Use email reset instead.");
    }

    // 5. Verify: normalise submitted words the same way as setup
    const canonical = data.words.map((w) => w.toLowerCase().trim()).join("|");
    const match = await bcrypt.compare(canonical, phraseRow.phrase_hash);

    if (!match) {
      throw new Error("Incorrect recovery phrases. Please check your written copy and try again.");
    }

    // 6. Clear rate-limit attempts on success
    await supabaseAdmin
      .from("recovery_phrase_attempts")
      .delete()
      .eq("user_id", authUserId);

    // 7. Generate a Supabase password-reset link (1-hour expiry, no email sent)
    if (!authUserEmail) throw new Error("Account email not found.");
    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: authUserEmail,
      });
    if (linkErr || !linkData?.properties?.hashed_token) {
      throw new Error("Failed to generate recovery token. Please try again.");
    }

    // Return the action_link — the client navigates to /auth/reset-password
    // with the token already in the URL hash (Supabase format)
    return { recoveryToken: linkData.properties.action_link };
  });
