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

// ── Premium downline counts for time-windowed achievements ──────────────────
// Returns Gen 1 and total downline members whose membership_tier is premium
// and premium_activated_at falls within a given number of days.
// This powers the "50 premium Gen 1 within 3 months" family of achievements.

export type PremiumDownlineWindow = {
  /** Premium Gen 1 referrals activated within the window */
  premiumGen1InWindow: number;
  /** Premium members across all generations activated within the window */
  premiumNetworkInWindow: number;
  /** Best (highest) rolling 90-day window count for Gen 1 premium referrals */
  bestGen1Window: number;
  /** Best rolling 90-day window count for total premium network */
  bestNetworkWindow: number;
};

export const getPremiumDownlineWindow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PremiumDownlineWindow> => {
    const { supabase, userId } = context;

    // Fetch all downlines
    const { data: dlRows, error: dlErr } = await supabase.rpc("get_my_downlines");
    if (dlErr) throw new Error(dlErr.message);
    const downlines = dlRows ?? [];
    if (downlines.length === 0) {
      return { premiumGen1InWindow: 0, premiumNetworkInWindow: 0, bestGen1Window: 0, bestNetworkWindow: 0 };
    }

    // Fetch premium status for all downline members
    const memberIds = downlines.map((d: { id: string }) => d.id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, membership_tier, premium_activated_at")
      .in("id", memberIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

    // Build a list of premium activation timestamps per generation
    type PremiumEvent = { generation: number; activatedAt: Date };
    const events: PremiumEvent[] = [];

    for (const dl of downlines) {
      const prof = profileMap.get(dl.id);
      if (!prof) continue;
      if (prof.membership_tier !== "premium" && prof.membership_tier !== "gold" && prof.membership_tier !== "platinum") continue;
      if (!prof.premium_activated_at) continue;
      events.push({
        generation: dl.generation,
        activatedAt: new Date(prof.premium_activated_at),
      });
    }

    const WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
    const now = Date.now();

    // Current window: last 90 days from now
    const windowStart = new Date(now - WINDOW_MS);
    const premiumGen1InWindow = events.filter(
      (e) => e.generation === 1 && e.activatedAt >= windowStart,
    ).length;
    const premiumNetworkInWindow = events.filter(
      (e) => e.activatedAt >= windowStart,
    ).length;

    // Best rolling window: find the 90-day interval that contains the most events
    // (sliding window over all event timestamps)
    function bestWindow(timestamps: Date[]): number {
      if (timestamps.length === 0) return 0;
      const sorted = timestamps.map((d) => d.getTime()).sort((a, b) => a - b);
      let best = 0;
      for (let i = 0; i < sorted.length; i++) {
        const windowEnd = sorted[i] + WINDOW_MS;
        const count = sorted.filter((t) => t >= sorted[i] && t <= windowEnd).length;
        if (count > best) best = count;
      }
      return best;
    }

    const gen1Timestamps = events.filter((e) => e.generation === 1).map((e) => e.activatedAt);
    const allTimestamps = events.map((e) => e.activatedAt);

    return {
      premiumGen1InWindow,
      premiumNetworkInWindow,
      bestGen1Window: bestWindow(gen1Timestamps),
      bestNetworkWindow: bestWindow(allTimestamps),
    };
  });

// ---------------------------------------------------------------------------
// Downline Network Report — detailed per-member stats for the report page
// ---------------------------------------------------------------------------

export type DownlineDetailRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  generation: number;
  joined_at: string;
  country: string | null;
  // Seeds they have invested across all active/completed cycles
  total_seeds_invested: number;
  // Commission earned by the current user FROM this specific downline member
  commissions_from_member: number;
  commission_count: number;
  last_commission_at: string | null;
};

export type DownlineReportData = {
  members: DownlineDetailRow[];
  seed_to_usdt: number;
  // Aggregated team analytics
  team: {
    total_members: number;
    gen1_count: number;
    gen2_count: number;
    gen3_count: number;
    total_commissions_seed: number;
    this_month_seed: number;
    most_active_gen: number;
    avg_commission_per_member: number;
    top_earner_id: string | null;
  };
};

export const getDownlineReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DownlineReportData> => {
    const { supabase, userId } = context;

    // Fetch all downlines via the existing SECURITY DEFINER RPC
    const { data: dlRows, error: dlErr } = await supabase.rpc("get_my_downlines");
    if (dlErr) throw new Error(dlErr.message);
    const downlines = dlRows ?? [];

    // Fetch seed_to_usdt rate
    const { data: settings } = await supabase
      .from("app_settings")
      .select("seed_to_usdt")
      .eq("id", true)
      .maybeSingle();
    const seedToUsdtRate = Number(settings?.seed_to_usdt ?? 1);

    if (downlines.length === 0) {
      return {
        members: [],
        seed_to_usdt: seedToUsdtRate,
        team: {
          total_members: 0,
          gen1_count: 0,
          gen2_count: 0,
          gen3_count: 0,
          total_commissions_seed: 0,
          this_month_seed: 0,
          most_active_gen: 1,
          avg_commission_per_member: 0,
          top_earner_id: null,
        },
      };
    }

    const memberIds = downlines.map((d) => d.id);

    // Fetch profile details (avatar, country) for all downline members
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, avatar_url, country")
      .in("id", memberIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Fetch cycles (seed investments) for all downline members
    const { data: cycles } = await supabase
      .from("cycles")
      .select("user_id, amount")
      .in("user_id", memberIds);
    // Sum seeds invested per member
    const cycleMap = new Map<string, number>();
    (cycles ?? []).forEach((c) => {
      cycleMap.set(c.user_id, (cycleMap.get(c.user_id) ?? 0) + Number(c.amount));
    });

    // Fetch all commissions earned by current user from each downline member
    const { data: allComms } = await supabase
      .from("affiliate_commissions")
      .select("from_user_id, amount, created_at")
      .eq("user_id", userId)
      .in("from_user_id", memberIds)
      .order("created_at", { ascending: false });

    // Group commissions by from_user_id
    const commMap = new Map<string, { total: number; count: number; last: string | null }>();
    (allComms ?? []).forEach((c) => {
      const entry = commMap.get(c.from_user_id) ?? { total: 0, count: 0, last: null };
      entry.total += Number(c.amount);
      entry.count += 1;
      if (!entry.last) entry.last = c.created_at;
      commMap.set(c.from_user_id, entry);
    });

    // Build member rows
    const members: DownlineDetailRow[] = downlines.map((d) => {
      const prof = profileMap.get(d.id);
      const comm = commMap.get(d.id) ?? { total: 0, count: 0, last: null };
      return {
        id: d.id,
        display_name: d.display_name,
        username: d.username,
        avatar_url: prof?.avatar_url ?? null,
        generation: d.generation,
        joined_at: d.created_at,
        country: prof?.country ?? null,
        total_seeds_invested: cycleMap.get(d.id) ?? 0,
        commissions_from_member: comm.total,
        commission_count: comm.count,
        last_commission_at: comm.last,
      };
    });

    // Team analytics
    const gen1 = members.filter((m) => m.generation === 1);
    const gen2 = members.filter((m) => m.generation === 2);
    const gen3 = members.filter((m) => m.generation === 3);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonthSeed = (allComms ?? [])
      .filter((c) => new Date(c.created_at) >= monthStart)
      .reduce((s, c) => s + Number(c.amount), 0);

    const totalCommSeed = members.reduce((s, m) => s + m.commissions_from_member, 0);

    // Generation with highest total commission
    const genTotals = [1, 2, 3].map((g) => ({
      gen: g,
      total: members.filter((m) => m.generation === g).reduce((s, m) => s + m.commissions_from_member, 0),
    }));
    const mostActiveGen = genTotals.sort((a, b) => b.total - a.total)[0]?.gen ?? 1;

    let topEarnerId: string | null = null;
    let topEarnerAmount = -1;
    members.forEach((m) => {
      if (m.commissions_from_member > topEarnerAmount) {
        topEarnerAmount = m.commissions_from_member;
        topEarnerId = m.id;
      }
    });

    return {
      members,
      seed_to_usdt: seedToUsdtRate,
      team: {
        total_members: members.length,
        gen1_count: gen1.length,
        gen2_count: gen2.length,
        gen3_count: gen3.length,
        total_commissions_seed: totalCommSeed,
        this_month_seed: thisMonthSeed,
        most_active_gen: mostActiveGen,
        avg_commission_per_member: members.length > 0 ? totalCommSeed / members.length : 0,
        top_earner_id: topEarnerAmount > 0 ? topEarnerId : null,
      },
    };
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
