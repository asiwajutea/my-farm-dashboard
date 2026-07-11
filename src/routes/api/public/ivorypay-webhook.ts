/**
 * IvoryPay webhook — POST /api/public/ivorypay-webhook
 *
 * IvoryPay sends a POST when a transaction changes state.
 * Signature is HMAC-SHA512 of JSON.stringify(body.data) in x-ivorypay-signature.
 * Webhook URL must be registered in: IvoryPay Dashboard → Settings → Webhooks
 *
 * On "cryptoCollection.success":
 *   1. Verify x-ivorypay-signature header
 *   2. Find deposit_requests row by body.data.reference (= our deposit ID)
 *   3. Credit wallet via wallet_adjust RPC
 *   4. Set deposit status → "approved"
 *   5. Notify user
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature, type IvoryPayWebhookPayload } from "@/lib/ivorypay";

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
        // 1. Parse body first (needed for both signature check and processing)
        let payload: IvoryPayWebhookPayload;
        let rawText: string;
        try {
          rawText = await request.text();
          payload = JSON.parse(rawText) as IvoryPayWebhookPayload;
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        // 2. Verify HMAC-SHA512 of JSON.stringify(payload.data)
        const signature = request.headers.get("x-ivorypay-signature");
        if (!verifyWebhookSignature(payload.data, signature)) {
          console.warn("[ivorypay-webhook] Invalid signature");
          return json({ ok: false, error: "unauthorized" }, 401);
        }

        const { event, data } = payload;
        console.log(`[ivorypay-webhook] event=${event} ref=${data?.reference}`);

        // 3. Only act on successful crypto collections
        //    Also handle fiatCollection.success if you later enable FIAT
        if (event !== "cryptoCollection.success" && event !== "fiatCollection.success") {
          return json({ ok: true, ignored: true });
        }

        if (!data?.reference) {
          return json({ ok: false, error: "missing_reference" }, 400);
        }

        // 4. Look up deposit_requests by reference (= our deposit request UUID)
        const { data: depositRow } = await supabaseAdmin
          .from("deposit_requests")
          .select("id, user_id, amount, status")
          .eq("id", data.reference)
          .maybeSingle();

        if (!depositRow) {
          console.error(`[ivorypay-webhook] No deposit for reference=${data.reference}`);
          // Return 200 so IvoryPay doesn't retry indefinitely
          return json({ ok: false, error: "deposit_not_found" }, 200);
        }

        // 5. Idempotency — already credited
        if (depositRow.status === "approved") {
          return json({ ok: true, already_processed: true });
        }

        // 6. Determine credited amount in USDT
        //    settledAmountInCrypto = what IvoryPay settled after fees
        const settledUsdt = Number(
          data.settledAmountInCrypto ?? data.receivedAmountInCrypto ?? depositRow.amount
        );

        // Convert USDT → Seed
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("seed_to_usdt")
          .eq("id", true)
          .maybeSingle();
        const rate = Number(settings?.seed_to_usdt ?? 1);
        const amountSeed = rate > 0 ? settledUsdt / rate : settledUsdt;

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

        // 8. Credit wallet via SECURITY DEFINER RPC
        const { error: rpcErr } = await supabaseAdmin.rpc("wallet_adjust", {
          p_wallet:    wallet.id,
          p_amount:    amountSeed,
          p_kind:      "deposit",
          p_memo:      `IvoryPay — ref:${data.reference}`,
          p_ref_table: "deposit_requests",
          p_ref_id:    depositRow.id,
        });

        if (rpcErr) {
          console.error("[ivorypay-webhook] wallet_adjust failed:", rpcErr.message);
          return json({ ok: false, error: "internal" }, 500);
        }

        // 9. Mark deposit approved
        await supabaseAdmin
          .from("deposit_requests")
          .update({ status: "approved" })
          .eq("id", depositRow.id);

        // 10. Notify user (non-fatal)
        try {
          await supabaseAdmin.rpc("notify_user", {
            p_user:      depositRow.user_id,
            p_kind:      "deposit_approved",
            p_title:     "Deposit approved 🎉",
            p_body:      `${settledUsdt.toFixed(2)} USDT has been credited to your Primary Wallet.`,
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
