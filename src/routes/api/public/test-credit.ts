// Service-role-only test-credit route (Req 10, 13, 14).
//
// Placed under src/routes/api/public/ (Req 14.1). It is a server route, NOT a
// createServerFn, and is intentionally outside any Supabase auth middleware: it
// authenticates by HMAC-SHA256 shared-secret signature over the raw request
// body (Req 14.2/14.3), not by a user session. A browser anon/authenticated
// session cannot forge the signature and is therefore rejected (Req 10.3/10.4).
//
// On a valid signed request it credits the target Farmer's Primary wallet via
// wallet_adjust(..., 'deposit', ...) — the SECURITY DEFINER, service_role-only
// money mutator — writing exactly one atomic `deposit` ledger row (Req 10.1,
// 9.1/9.2/9.3). Submissions elsewhere never move money (Req 9.4).

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_SKEW_MS = 5 * 60 * 1000; // reject stale timestamps to blunt replay

// ---------------------------------------------------------------------------
// Pure helpers (exported for property testing)
// ---------------------------------------------------------------------------

/**
 * Constant-time verification that `header` is the hex HMAC-SHA256 of `rawBody`
 * under `secret`. Returns false for a missing/blank header or any length
 * mismatch (Req 10.2, 14.2/14.3).
 */
export function verifySignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(header, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type TestCreditPayload = {
  user_id: string;
  amount: number;
  memo?: string;
  nonce?: string;
  ts?: number;
};

export type PayloadValidation =
  | { ok: true; value: { user_id: string; amount: number; memo?: string } }
  | { ok: false; field: "user_id" | "amount" };

/**
 * Validate the decoded payload: `user_id` must be a non-empty string and
 * `amount` a finite number greater than zero. Identifies the offending field
 * on failure (Req 10.5). Existence of the target Farmer is checked separately
 * against the database.
 */
export function validatePayload(input: unknown): PayloadValidation {
  if (!input || typeof input !== "object") {
    return { ok: false, field: "user_id" };
  }
  const p = input as Record<string, unknown>;
  if (typeof p.user_id !== "string" || p.user_id.trim() === "") {
    return { ok: false, field: "user_id" };
  }
  if (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount <= 0) {
    return { ok: false, field: "amount" };
  }
  return {
    ok: true,
    value: {
      user_id: p.user_id,
      amount: p.amount,
      memo: typeof p.memo === "string" ? p.memo : undefined,
    },
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/public/test-credit")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // 1. Server-only secret, read INSIDE the handler (Req 13.2).
        const secret = process.env.TEST_CREDIT_SECRET;
        if (!secret) {
          return json({ ok: false, error: "not_configured" }, 503);
        }

        // 2. Verify HMAC over the raw body (Req 10.2/10.4, 14.2/14.3).
        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-signature"), secret)) {
          return json({ ok: false, error: "invalid_signature" }, 401);
        }

        // 3. Parse + reject stale timestamps (replay hardening).
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }
        const ts = (parsed as TestCreditPayload)?.ts;
        if (typeof ts === "number" && Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
          return json({ ok: false, error: "stale_timestamp" }, 401);
        }

        // 4. Validate fields (Req 10.5).
        const validation = validatePayload(parsed);
        if (!validation.ok) {
          return json({ ok: false, error: "invalid_field", field: validation.field }, 400);
        }
        const { user_id, amount, memo } = validation.value;

        // 5. Look up the target's Primary wallet via service-role client.
        const { data: wallet, error: walletErr } = await supabaseAdmin
          .from("wallets")
          .select("id")
          .eq("user_id", user_id)
          .eq("kind", "primary")
          .maybeSingle();
        if (walletErr) {
          return json({ ok: false, error: "internal" }, 500);
        }
        if (!wallet) {
          return json({ ok: false, error: "invalid_field", field: "user_id" }, 400);
        }

        // 6. Credit via the SECURITY DEFINER, service_role-only money mutator.
        const { error: rpcErr } = await supabaseAdmin.rpc("wallet_adjust", {
          p_wallet: wallet.id,
          p_amount: amount,
          p_kind: "deposit",
          p_memo: memo ?? "test_credit",
          p_ref_table: "deposit_requests",
        });
        if (rpcErr) {
          return json({ ok: false, error: "internal" }, 500);
        }

        return json({ ok: true, ledgerWritten: true }, 200);
      },
    },
  },
});
