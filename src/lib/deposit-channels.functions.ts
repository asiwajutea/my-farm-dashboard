/**
 * Deposit channel server functions.
 *
 * getDepositChannelStatus — public (authenticated); returns whether each
 *   channel is open, and today's IvoryPay usage vs the daily cap.
 *
 * adminGetDepositChannelSettings — admin only; returns editable settings.
 * adminUpdateDepositChannelSettings — admin only; saves settings.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Types ──────────────────────────────────────────────────────────────────

export type DepositChannelStatus = {
  ivorypay: {
    enabled:         boolean;
    dailyLimitUsdt:  number;   // 0 = unlimited
    todayUsdt:       number;   // USDT deposited today via IvoryPay
    limitReached:    boolean;
    lockedReason:    string | null;
  };
  manual: {
    enabled:      boolean;
    lockedReason: string | null;
  };
};

export type DepositChannelSettings = {
  ivorypay_enabled:           boolean;
  ivorypay_daily_limit_usdt:  number;
  ivorypay_locked_reason:     string | null;
  manual_deposit_enabled:     boolean;
  manual_deposit_locked_reason: string | null;
};

// ── User-facing: channel availability + today's usage ────────────────────

export const getDepositChannelStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DepositChannelStatus> => {
    const { supabase } = context;

    // Load channel settings from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select(
        "ivorypay_enabled, ivorypay_daily_limit_usdt, ivorypay_locked_reason, manual_deposit_enabled, manual_deposit_locked_reason"
      )
      .eq("id", true)
      .maybeSingle();

    const ivoryEnabled      = settings?.ivorypay_enabled           ?? true;
    const dailyLimitUsdt    = Number(settings?.ivorypay_daily_limit_usdt ?? 0);
    const ivoryLockedReason = settings?.ivorypay_locked_reason     ?? null;
    const manualEnabled     = settings?.manual_deposit_enabled     ?? true;
    const manualLockedReason = settings?.manual_deposit_locked_reason ?? null;

    // Calculate today's IvoryPay deposits (approved rows, UTC day)
    let todayUsdt = 0;
    if (ivoryEnabled && dailyLimitUsdt > 0) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { data: todayRows } = await supabase
        .from("deposit_requests")
        .select("amount")
        .eq("method", "ivorypay")
        .eq("status", "approved")
        .gte("created_at", todayStart.toISOString());

      // amount is stored in Seed — convert back to USDT
      const { data: rateRow } = await supabase
        .from("app_settings")
        .select("seed_to_usdt")
        .eq("id", true)
        .maybeSingle();
      const rate = Number(rateRow?.seed_to_usdt ?? 1);

      todayUsdt = (todayRows ?? []).reduce(
        (sum, r) => sum + Number(r.amount) * rate,
        0,
      );
    }

    const limitReached = dailyLimitUsdt > 0 && todayUsdt >= dailyLimitUsdt;

    return {
      ivorypay: {
        enabled:        ivoryEnabled,
        dailyLimitUsdt,
        todayUsdt:      Math.round(todayUsdt * 100) / 100,
        limitReached,
        lockedReason:   ivoryLockedReason,
      },
      manual: {
        enabled:      manualEnabled,
        lockedReason: manualLockedReason,
      },
    };
  });

// ── Admin: read settings ──────────────────────────────────────────────────

export const adminGetDepositChannelSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DepositChannelSettings> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { data } = await context.supabase
      .from("app_settings")
      .select(
        "ivorypay_enabled, ivorypay_daily_limit_usdt, ivorypay_locked_reason, manual_deposit_enabled, manual_deposit_locked_reason"
      )
      .eq("id", true)
      .maybeSingle();

    return {
      ivorypay_enabled:             data?.ivorypay_enabled           ?? true,
      ivorypay_daily_limit_usdt:    Number(data?.ivorypay_daily_limit_usdt ?? 0),
      ivorypay_locked_reason:       data?.ivorypay_locked_reason     ?? null,
      manual_deposit_enabled:       data?.manual_deposit_enabled     ?? true,
      manual_deposit_locked_reason: data?.manual_deposit_locked_reason ?? null,
    };
  });

// ── Admin: update settings ────────────────────────────────────────────────

export const adminUpdateDepositChannelSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ivorypay_enabled:             z.boolean(),
      ivorypay_daily_limit_usdt:    z.number().min(0),
      ivorypay_locked_reason:       z.string().max(200).nullable(),
      manual_deposit_enabled:       z.boolean(),
      manual_deposit_locked_reason: z.string().max(200).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update(data)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
