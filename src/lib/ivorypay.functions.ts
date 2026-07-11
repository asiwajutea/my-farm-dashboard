/**
 * IvoryPay server functions — called from the deposit UI.
 *
 * initiateIvoryPayDeposit:
 *   1. Creates a deposit_requests row (status: "pending", method: "ivorypay")
 *   2. Creates an IvoryPay transaction via their API
 *   3. Stores the IvoryPay transaction ID in deposit_requests.external_ref
 *   4. Returns the payment URL for the user to complete payment
 *
 * checkIvoryPayDeposit:
 *   Poll the IvoryPay API for the transaction status (fallback if webhook is missed).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NETWORK_LABELS: Record<string, string> = {
  tron: "USDT (TRC20)",
  ethereum: "USDT (ERC20)",
  bsc: "USDT (BEP20)",
};

// ── Initiate ──────────────────────────────────────────────────────────────

export const initiateIvoryPayDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amountUsdt:    z.number().positive().max(999999),
      network:       z.enum(["tron", "ethereum", "bsc"]),
      customerEmail: z.string().email().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ paymentUrl: string; depositRequestId: string }> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createTransaction } = await import("@/lib/ivorypay");

    // 1. Look up user email for IvoryPay (improves their risk scoring)
    const { data: { user } } = await supabase.auth.getUser();
    const email = data.customerEmail ?? user?.email;

    // 2. Read the Seed conversion rate so we can store the Seed-denominated amount
    const { data: settings } = await supabase
      .from("app_settings")
      .select("seed_to_usdt")
      .eq("id", true)
      .maybeSingle();
    const rate = Number(settings?.seed_to_usdt ?? 1);
    const amountSeed = rate > 0 ? data.amountUsdt / rate : data.amountUsdt;

    // 3. Insert pending deposit_request row first so we have an ID for the reference
    const { data: depRow, error: depErr } = await supabaseAdmin
      .from("deposit_requests")
      .insert({
        user_id: userId,
        amount:  amountSeed,
        method:  "ivorypay",
        status:  "pending",
      })
      .select("id")
      .single();
    if (depErr || !depRow) throw new Error(depErr?.message ?? "Failed to create deposit record");

    const depositRequestId = depRow.id;

    // 4. Build the webhook URL — IvoryPay will POST to this on payment completion
    const siteUrl = process.env.SITE_URL ?? "https://vfarmers.app";
    const webhookUrl = `${siteUrl}/api/public/ivorypay-webhook`;
    const redirectUrl = `${siteUrl}/deposit?ivorypay=success&ref=${depositRequestId}`;

    // 5. Create the IvoryPay transaction
    let ivoryTx;
    try {
      ivoryTx = await createTransaction({
        amount:        data.amountUsdt,
        token:         "USDT",
        network:       data.network,
        reference:     depositRequestId,   // stored in metadata so webhook can find it
        webhookUrl,
        redirectUrl,
        customerEmail: email,
      });
    } catch (err) {
      // Roll back the deposit row if IvoryPay call fails
      await supabaseAdmin
        .from("deposit_requests")
        .delete()
        .eq("id", depositRequestId);
      throw err;
    }

    // 6. Store the IvoryPay transaction ID for webhook matching and status polling
    await supabaseAdmin
      .from("deposit_requests")
      .update({ external_ref: ivoryTx.id })
      .eq("id", depositRequestId);

    return { paymentUrl: ivoryTx.paymentUrl, depositRequestId };
  });

// ── Status poll (fallback) ────────────────────────────────────────────────

export const checkIvoryPayDeposit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ depositRequestId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{
    status: "pending" | "approved" | "rejected" | "processing";
    amountUsdt?: number;
  }> => {
    const { supabase, userId } = context;

    // Load the deposit row (RLS ensures ownership)
    const { data: dep } = await supabase
      .from("deposit_requests")
      .select("status, external_ref, amount")
      .eq("id", data.depositRequestId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!dep) throw new Error("Deposit not found");

    // Already resolved — return DB state
    if (dep.status === "approved" || dep.status === "rejected") {
      return { status: dep.status };
    }

    // No external_ref yet — still waiting
    if (!dep.external_ref) return { status: "pending" };

    // Poll IvoryPay
    const { getTransaction } = await import("@/lib/ivorypay");
    const tx = await getTransaction(dep.external_ref);

    if (tx.status === "completed") return { status: "approved", amountUsdt: tx.amountReceived ?? tx.amount };
    if (tx.status === "failed" || tx.status === "expired") return { status: "rejected" };
    if (tx.status === "processing") return { status: "processing" };

    return { status: "pending" };
  });
