/**
 * IvoryPay server functions.
 *
 * initiateIvoryPayDeposit:
 *   1. Creates a deposit_requests row (status: "pending", method: "ivorypay")
 *   2. Creates an IvoryPay CHECKOUT transaction via their API
 *   3. Stores the reference (= deposit request ID) as external_ref
 *   4. Returns the checkoutUrl for the user to complete payment
 *
 * checkIvoryPayDeposit:
 *   Verifies the transaction status via IvoryPay's public verify endpoint.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Initiate ──────────────────────────────────────────────────────────────

export const initiateIvoryPayDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amountUsdt: z.number().positive().max(999999),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{
    checkoutUrl: string;
    depositRequestId: string;
  }> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutTransaction } = await import("@/lib/ivorypay");

    // 1. Get user info for IvoryPay (email required, name used for receipt)
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email ?? "customer@vfarmers.app";
    const fullName: string = (user?.user_metadata?.full_name as string | undefined) ?? "";
    const [firstName = "VFarmers", lastName = "User"] = fullName.trim().split(/\s+/);

    // 2. Read Seed conversion rate
    const { data: settings } = await supabase
      .from("app_settings")
      .select("seed_to_usdt")
      .eq("id", true)
      .maybeSingle();
    const rate = Number(settings?.seed_to_usdt ?? 1);
    const amountSeed = rate > 0 ? data.amountUsdt / rate : data.amountUsdt;

    // 3. Insert pending deposit_requests row — its UUID becomes our IvoryPay reference
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
    // IvoryPay docs use full UUIDs for reference (36 chars with hyphens is fine)
    // Store as external_ref for webhook matching
    const siteUrl = process.env.SITE_URL ?? "https://vfarmers.app";

    // 4. Create the IvoryPay CHECKOUT transaction.
    //    Pass the USDT amount directly — IvoryPay handles fiat display conversion.
    //    baseFiat: "NGN" is required by IvoryPay (their only supported baseFiat).
    let checkoutTx;
    try {
      checkoutTx = await createCheckoutTransaction({
        amount:      data.amountUsdt,             // pass USDT amount directly
        email,
        firstName:   firstName ?? "VFarmers",
        lastName:    lastName ?? "User",
        baseFiat:    "NGN",
        crypto:      "USDT",
        reference:   depositRequestId,
        redirect_url: `${siteUrl}/deposit?ivorypay=success&ref=${depositRequestId}`,
      });
    } catch (err) {
      // Roll back the deposit row if IvoryPay call fails
      await supabaseAdmin.from("deposit_requests").delete().eq("id", depositRequestId);
      // Surface the real IvoryPay error message to the client
      const msg = err instanceof Error ? err.message : "IvoryPay payment initiation failed";
      throw new Error(msg);
    }

    // 5. Store the full UUID as external_ref for webhook matching
    await supabaseAdmin
      .from("deposit_requests")
      .update({ external_ref: depositRequestId })
      .eq("id", depositRequestId);

    return { checkoutUrl: checkoutTx.checkoutUrl, depositRequestId };
  });

// ── Status check (fallback polling) ──────────────────────────────────────

export const checkIvoryPayDeposit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ depositRequestId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{
    status: "pending" | "processing" | "approved" | "rejected";
  }> => {
    const { supabase, userId } = context;

    // Load the deposit row (RLS ensures ownership)
    const { data: dep } = await supabase
      .from("deposit_requests")
      .select("status, external_ref")
      .eq("id", data.depositRequestId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!dep) throw new Error("Deposit not found");

    // Already resolved in DB
    if (dep.status === "approved") return { status: "approved" };
    if (dep.status === "rejected") return { status: "rejected" };

    // Poll IvoryPay's public verify endpoint using the deposit UUID as reference
    const reference = dep.external_ref ?? data.depositRequestId;
    try {
      const { verifyTransaction } = await import("@/lib/ivorypay");
      const result = await verifyTransaction(reference);

      if (result.status === "SUCCESS")    return { status: "approved" };
      if (result.status === "FAILED" ||
          result.status === "EXPIRED" ||
          result.status === "MISMATCH")   return { status: "rejected" };
      if (result.status === "PROCESSING" ||
          result.status === "CONFIRMING") return { status: "processing" };
    } catch {
      // IvoryPay verify failed — return DB status
    }

    return { status: "pending" };
  });
