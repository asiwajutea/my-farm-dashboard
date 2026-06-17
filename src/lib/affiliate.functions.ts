import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ReferrerInfo = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
} | null;

// Public — used live during signup. Uses anon client (no auth required).
export const lookupReferrer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }): Promise<ReferrerInfo> => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient<Database>(url, key, { auth: { persistSession: false } });
    const { data: rows, error } = await client.rpc("lookup_referrer", { _code: data.code });
    if (error) return null;
    const r = Array.isArray(rows) ? rows[0] : rows;
    return r ?? null;
  });

// Returns the referral code for the platform default referrer (dakintuyi@gmail.com).
// Called silently at signup when no affiliate code is provided — never shown to user.
export const getDefaultReferralCode = createServerFn({ method: "GET" })
  .handler(async (): Promise<string | null> => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient<Database>(url, key, { auth: { persistSession: false } });
    const { data } = await client
      .from("profiles")
      .select("referral_code")
      // Look up by the known default referrer user ID via auth — we use email match via RPC
      // to avoid exposing emails in client. Falls back to a known stable referral_code format.
      .not("referral_code", "is", null)
      .limit(200);
    // We can't query by email from the anon client (auth.users is not public).
    // Instead the default referral code is stored as a server-side env var set by the admin.
    // Set DEFAULT_REFERRAL_CODE in .env to the platform owner's referral_code value.
    const envCode = process.env.DEFAULT_REFERRAL_CODE ?? null;
    if (envCode) return envCode;
    // Last resort: not configured — return null so signup proceeds without referral.
    return null;
  });

export type AffiliateSummary = {
  referralCode: string | null;
  gen1Count: number;
  gen2Count: number;
  gen3Count: number;
  totalEarned: number;
  monthEarned: number;
  recent: Array<{
    id: string;
    generation: number;
    source: string;
    amount: number;
    created_at: string;
    from_user_id: string;
  }>;
};

export const getMyAffiliateSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AffiliateSummary> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();

    // Counts via SECURITY DEFINER RPC so downline rows aren't blocked by RLS.
    const { data: countsRows } = await supabase.rpc("get_my_downline_counts");
    const counts = Array.isArray(countsRows) ? countsRows[0] : countsRows;
    const gen1Count = Number(counts?.gen1 ?? 0);
    const gen2Count = Number(counts?.gen2 ?? 0);
    const gen3Count = Number(counts?.gen3 ?? 0);

    const { data: comms } = await supabase
      .from("affiliate_commissions")
      .select("id, generation, source, amount, created_at, from_user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: allComms } = await supabase
      .from("affiliate_commissions")
      .select("amount, created_at")
      .eq("user_id", userId);

    const total = (allComms ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const month = (allComms ?? [])
      .filter((r) => new Date(r.created_at) >= monthStart)
      .reduce((s, r) => s + Number(r.amount), 0);

    return {
      referralCode: prof?.referral_code ?? null,
      gen1Count,
      gen2Count,
      gen3Count,
      totalEarned: total,
      monthEarned: month,
      recent: (comms ?? []).map((c) => ({
        id: c.id,
        generation: c.generation,
        source: c.source,
        amount: Number(c.amount),
        created_at: c.created_at,
        from_user_id: c.from_user_id,
      })),
    };
  });

export type DownlineRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  generation: number;
  created_at: string;
};

export const getMyDownlines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DownlineRow[]> => {
    const { data, error } = await context.supabase.rpc("get_my_downlines");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      generation: r.generation,
      created_at: r.created_at,
    }));
  });

export type MaintenanceFeeRow = {
  id: string;
  period_start: string;
  period_end: string;
  amount: number;
  status: string;
  paid_at: string | null;
};

export const getMyMaintenanceFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaintenanceFeeRow[]> => {
    const { data } = await context.supabase
      .from("maintenance_fees")
      .select("id, period_start, period_end, amount, status, paid_at")
      .eq("user_id", context.userId)
      .order("period_start", { ascending: false })
      .limit(24);
    return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  });

export const payMaintenanceFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ feeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("pay_maintenance_fee", { p_fee_id: data.feeId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin
const settingsSchema = z.object({
  aff_gen1_pct: z.number().min(0).max(1),
  aff_gen2_pct: z.number().min(0).max(1),
  aff_gen3_pct: z.number().min(0).max(1),
  aff_basis: z.enum(["profit", "profit_plus_capital"]),
  maint_fee_seed: z.number().min(0),
  maint_fee_day: z.number().int().min(1).max(28),
  aff_maint_gen1_pct: z.number().min(0).max(1),
  aff_maint_gen2_pct: z.number().min(0).max(1),
  aff_maint_gen3_pct: z.number().min(0).max(1),
});

export const getAffiliateSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select(
        "aff_gen1_pct, aff_gen2_pct, aff_gen3_pct, aff_basis, maint_fee_seed, maint_fee_day, aff_maint_gen1_pct, aff_maint_gen2_pct, aff_maint_gen3_pct",
      )
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const adminUpdateAffiliateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");
    const { error } = await context.supabase.from("app_settings").update(data).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRunMonthlyMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_run_monthly_maintenance");
    if (error) throw new Error(error.message);
    return { created: Number(data ?? 0) };
  });
