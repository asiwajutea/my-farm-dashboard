/**
 * IvoryPay webhook handler — POST /api/public/ivorypay-webhook
 *
 * IvoryPay POSTs a JSON body with event + data when a transaction status changes.
 * On "transaction.completed" we:
 *   1. Verify the Authorization header matches IVORYPAY_SECRET_KEY
 *   2. Look up the deposit_requests row by external_ref (IvoryPay tx ID)
 *      OR by metadata.reference (our deposit request ID)
 *   3. Update status → "approved"
 *   4. Credit the user's Primary wallet via wallet_adjust RPC
 *   5. Notify the user
 *
 * IvoryPay expects a 200 response — any non-2xx causes a retry.
 * We are idempotent: if the deposit is already approved we return 200 immediately.
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { IvoryPayWebhookEvent } from "@/lib/ivorypay";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/ivorypay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // 1. Verify the Authorization header — IvoryPay sends the merchant secret key
        const authHeader = request.headers.get("authorization") ?? "";
        const secretKey = process.env.IVORYPAY_SECRET_KEY;

        if (!secretKey) {
          console.error("[ivorypay-webhook] IVORYPAY_SECRET_KEY not configured");
          return json({ ok: false, error: "not_configured" }, 503);
        }

        // IvoryPay sends the secret key directly in the Authorization header
        if (authHeader !== secretKey) {
          console.warn("[ivorypay-webhook] Invalid authorization header");
          return json({ ok: false, error: "unauthorized" }, 401);
        }

        // 2. Parse body
        let event: IvoryPayWebhookEvent;
        try {
          event = (await request.json()) as IvoryPayWebhookEvent;
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        console.log(`[ivorypay-webhook] event=${event.event} tx=${event.data?.id}`);

        // 3. Only act on completed transactions
        if (event.event !== "transaction.completed") {
          return json({ ok: true, ignored: true });
        }

        const tx = event.data;
        if (!tx?.id) return json({ ok: false, error: "missing_tx_id" }, 400);

        // 4. Find the deposit_requests row
        //    Try external_ref (IvoryPay tx ID) first, then metadata.reference (our deposit ID)
        let depositRow: { id: string; user_id: string; amount: number; status: string } | null = null;

        // Try by external_ref
        const { data: byRef } = await supabaseAdmin
          .from("deposit_requests")
          .select("id, user_id, amount, status")
          .eq("external_ref", tx.id)
          .maybeSingle();
        depositRow = byRef ?? null;

        // Fallback: try metadata.reference as deposit request ID
        if (!depositRow && tx.metadata?.reference) {
          const { data: byMeta } = await supabaseAdmin
            .from("deposit_requests")
            .select("id, user_id, amount, status")
            .eq("id", tx.metadata.reference)
            .maybeSingle();
          depositRow = byMeta ?? null;

          // Store the external_ref now that we have it
          if (depositRow) {
            await supabaseAdmin
              .from("deposit_requests")
              .update({ external_ref: tx.id })
              .eq("id", depositRow.id);
          }
        }

        if (!depositRow) {
          console.error(`[ivorypay-webhook] No deposit found for tx=${tx.id}`);
          // Return 200 so IvoryPay doesn't retry — we can't match this payment
          return json({ ok: false, error: "deposit_not_found" }, 200);
        }

        // 5. Idempotency — already processed
        if (depositRow.status === "approved") {
          return json({ ok: true, already_processed: true });
        }

        // 6. Use the amount IvoryPay actually received (may differ slightly from requested)
        const receivedUsdt = tx.amountReceived ?? tx.amount ?? depositRow.amount;

        // Convert USDT → Seed for the wallet credit
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("seed_to_usdt")
          .eq("id", true)
          .maybeSingle();
        const rate = Number(settings?.seed_to_usdt ?? 1);
        const amountSeed = rate > 0 ? receivedUsdt / rate : receivedUsdt;

        // 7. Look up user's Primary wallet
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("id")
          .eq("user_id", depositRow.user_id)
          .eq("kind", "primary")
          .maybeSingle();

        if (!wallet) {
          console.error(`[ivorypay-webhook] No primary wallet for user ${depositRow.user_id}`);
          return json({ ok: false, error: "wallet_not_found" }, 200);
        }

        // 8. Atomically: credit wallet + mark deposit approved
        const { error: rpcErr } = await supabaseAdmin.rpc("wallet_adjust", {
          p_wallet:    wallet.id,
          p_amount:    amountSeed,
          p_kind:      "deposit",
          p_memo:      `IvoryPay deposit — tx:${tx.id}`,
          p_ref_table: "deposit_requests",
          p_ref_id:    depositRow.id,
        });

        if (rpcErr) {
          console.error("[ivorypay-webhook] wallet_adjust failed:", rpcErr.message);
          return json({ ok: false, error: "internal" }, 500);
        }

        // 9. Mark the deposit as approved
        await supabaseAdmin
          .from("deposit_requests")
          .update({ status: "approved" })
          .eq("id", depositRow.id);

        // 10. Notify the user (non-fatal if it fails)
        try {
          await supabaseAdmin.rpc("notify_user", {
            p_user:      depositRow.user_id,
            p_kind:      "deposit_approved",
            p_title:     "Deposit approved 🎉",
            p_body:      `${receivedUsdt.toFixed(2)} USDT has been credited to your Primary Wallet.`,
            p_ref_table: "deposit_requests",
            p_ref_id:    depositRow.id,
          });
        } catch (e) {
          console.warn("[ivorypay-webhook] notify_user failed:", e);
        }

        console.log(`[ivorypay-webhook] Credited ${amountSeed} Seed to user ${depositRow.user_id}`);
        return json({ ok: true });
      },
    },
  },
});
