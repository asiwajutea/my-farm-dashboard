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

    // 0. Check channel availability and daily limit
    const { getDepositChannelStatus } = await import("@/lib/deposit-channels.functions");
    // Call directly with the supabase client since we're already server-side
    const { data: channelSettings } = await supabase
      .from("app_settings")
      .select("ivorypay_enabled, ivorypay_daily_limit_usdt, ivorypay_locked_reason, seed_to_usdt")
      .eq("id", true)
      .maybeSingle();

    if (channelSettings?.ivorypay_enabled === false) {
      throw new Error(channelSettings.ivorypay_locked_reason ?? "IvoryPay deposits are currently unavailable.");
    }

    const dailyLimitUsdt = Number(channelSettings?.ivorypay_daily_limit_usdt ?? 0);
    if (dailyLimitUsdt > 0) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data: todayRows } = await supabase
        .from("deposit_requests")
        .select("amount")
        .eq("method", "ivorypay")
        .eq("status", "approved")
        .gte("created_at", todayStart.toISOString());
      const rate = Number(channelSettings?.seed_to_usdt ?? 1);
      const todayUsdt = (todayRows ?? []).reduce((s, r) => s + Number(r.amount) * rate, 0);
      if (todayUsdt + data.amountUsdt > dailyLimitUsdt) {
        throw new Error(
          `Daily IvoryPay deposit limit of ${dailyLimitUsdt} USDT reached. Please try again tomorrow or use manual deposit.`
        );
      }
    }

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
        redirect_url: `${siteUrl}/deposit?ivorypay=success`,
        // Note: IvoryPay will append ?reference=<ref> to this URL automatically.
        // We store our depositRequestId as the reference so we can extract it
        // from the appended reference param on return.
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
    z.object({
      // Accept any non-empty string — the DB query will return nothing if it's not a real UUID
      depositRequestId: z.string().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{
    status: "pending" | "processing" | "approved" | "rejected";
  }> => {
    const { supabase, userId } = context;

    // Select only 'status' — avoids type errors from new columns (external_ref)
    // that may not be in the generated Supabase types yet.
    // RLS on deposit_requests ensures the user can only read their own rows.
    const { data: dep, error: depErr } = await supabase
      .from("deposit_requests")
      .select("id, status")
      .eq("id", data.depositRequestId)
      .eq("user_id", userId)
      .maybeSingle();

    if (depErr) {
      console.error("[checkIvoryPayDeposit] DB error:", depErr.message);
      throw new Error("Failed to check deposit status");
    }

    if (!dep) throw new Error("Deposit not found");

    // DB is authoritative — webhook already updated this
    if (dep.status === "approved") return { status: "approved" };
    if (dep.status === "rejected") return { status: "rejected" };

    // Poll IvoryPay's public verify endpoint as a fallback
    try {
      const { verifyTransaction } = await import("@/lib/ivorypay");
      const result = await verifyTransaction(data.depositRequestId);

      if (result.status === "SUCCESS")    return { status: "approved" };
      if (result.status === "FAILED" ||
          result.status === "EXPIRED" ||
          result.status === "MISMATCH")   return { status: "rejected" };
      if (result.status === "PROCESSING" ||
          result.status === "CONFIRMING") return { status: "processing" };
    } catch (verifyErr) {
      // IvoryPay verify unavailable — return current DB status
      console.warn("[checkIvoryPayDeposit] verify failed:", verifyErr);
    }

    return { status: "pending" };
  });
