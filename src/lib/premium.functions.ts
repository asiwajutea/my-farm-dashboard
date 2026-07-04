// Premium Membership — server functions and shared types.
// Types are defined here for use by server functions (added in tasks 5.1–5.5)
// and by UI components throughout the feature.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Types ────────────────────────────────────────────────────────────────────

export type MembershipTier = 'standard' | 'premium' | 'gold' | 'platinum';

export type PremiumBenefitsSnapshot = {
  farming_bonus_pct: number;
  referral_gen2_pct: number;
  referral_gen3_pct: number;
  withdrawal_fee_premium_pct: number;
  maintenance_ref_gen1_pct: number;
  maintenance_ref_gen2_pct: number;
  maintenance_ref_gen3_pct: number;
};

export type PremiumStatus = {
  tier: MembershipTier;
  expires_at: string | null; // ISO timestamp
  days_left: number;         // >= 0; 0 when expired or standard
  badge_name: string;
  badge_color: string;
  benefits: PremiumBenefitsSnapshot;
};

export type PremiumConfig = {
  premium_enabled: boolean;
  premium_fee_usdt: number;
  premium_duration_days: number;
  premium_badge_name: string;
  premium_badge_color: string;
  premium_farming_bonus_pct: number;
  referral_gen2_pct: number;
  referral_gen3_pct: number;
  withdrawal_fee_premium_pct: number;
};

export type PremiumAdminSettings = PremiumConfig & {
  withdrawal_fee_standard_pct: number;
  maintenance_ref_gen1_pct: number;
  maintenance_ref_gen2_pct: number;
  maintenance_ref_gen3_pct: number;
};

// All fields required for admin settings form submission.
export type PremiumAdminSettingsInput = PremiumAdminSettings;

export type PremiumMetrics = {
  premium_count: number;
  standard_count: number;
  conversion_rate: number;
  total_revenue_usdt: number;
  top_referrers: Array<{
    user_id: string;
    display_name: string | null;
    username: string | null;
    total_commissions: number;
  }>;
};

export type PremiumError = {
  error: string;
  field?: string;
};

// ── Pure Formula Helpers ──────────────────────────────────────────────────────
// These functions contain no DB I/O and are extracted for property-based testing.
// All nullable percentage parameters use ?? 0 (COALESCE-equivalent).

/**
 * Compute farming reward for a single cycle reap.
 *
 * Premium active:  reward = amount * base / 100 * (1 + bonusPct / 100)
 * Standard/expired: reward = amount * base / 100
 *
 * Validates: Requirements 5.1, 5.2, 5.7
 */
export function computeFarmingReward(
  base: number,
  bonusPct: number | null | undefined,
  amount: number,
  isPremiumActive: boolean,
): number {
  const bonus = bonusPct ?? 0;
  const baseReward = amount * base / 100;
  if (isPremiumActive) {
    return baseReward * (1 + bonus / 100);
  }
  return baseReward;
}

/**
 * Compute farming reward when a booster multiplier is also applied.
 * Booster stacks on top of the premium bonus (applied after premium bonus).
 *
 * Premium active:  reward = amount * base / 100 * (1 + bonusPct / 100) * boosterMul
 * Standard/expired: reward = amount * base / 100 * boosterMul
 *
 * Validates: Requirements 5.4
 */
export function computeFarmingRewardWithBooster(
  base: number,
  bonusPct: number | null | undefined,
  boosterMul: number,
  amount: number,
  isPremiumActive: boolean,
): number {
  return computeFarmingReward(base, bonusPct, amount, isPremiumActive) * boosterMul;
}

/**
 * Compute referral commission for a given generation and upline tier state.
 *
 * Standard or expired premium:
 *   Gen1 = reapAmount * gen1Pct / 100
 *   Gen2 / Gen3 = 0
 * Active premium:
 *   Gen G = reapAmount * genGPct / 100
 *
 * @param reapAmount     The amount being reaped by the downline user.
 * @param genGPct        The configured percentage for this generation (gen1, gen2, or gen3).
 * @param generation     The generation number (1, 2, or 3).
 * @param isUplinePremiumActive  Whether the upline sponsor currently holds active premium.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function computeReferralCommission(
  reapAmount: number,
  genGPct: number | null | undefined,
  generation: 1 | 2 | 3,
  isUplinePremiumActive: boolean,
): number {
  const pct = genGPct ?? 0;
  if (!isUplinePremiumActive && generation !== 1) {
    return 0;
  }
  return reapAmount * pct / 100;
}

/**
 * Compute maintenance fee referral reward for an upline sponsor.
 *
 * Active premium:   feeAmount * genGPct / 100
 * Standard/expired: 0
 *
 * Validates: Requirements 7.1–7.5, 7.8
 */
export function computeMaintenanceRefReward(
  feeAmount: number,
  genGPct: number | null | undefined,
  isUplinePremiumActive: boolean,
): number {
  if (!isUplinePremiumActive) {
    return 0;
  }
  const pct = genGPct ?? 0;
  return feeAmount * pct / 100;
}

/**
 * Compute the withdrawal fee for a given amount and membership tier state.
 *
 * Standard/expired: amount * standardPct / 100
 * Active premium:   amount * premiumPct / 100
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.7
 */
export function computeWithdrawalFee(
  amount: number,
  standardPct: number | null | undefined,
  premiumPct: number | null | undefined,
  isPremiumActive: boolean,
): number {
  if (isPremiumActive) {
    return amount * (premiumPct ?? 0) / 100;
  }
  return amount * (standardPct ?? 0) / 100;
}

/**
 * Compute the number of days remaining until `expiresAt`.
 *
 * Returns max(0, floor((expiresAt - now) / 86_400_000)).
 * Returns 0 when `expiresAt` is null.
 *
 * Validates: Requirements 4.4, 4.5
 */
export function computeDaysLeft(expiresAt: string | null): number {
  if (expiresAt === null) {
    return 0;
  }
  const msPerDay = 86_400_000;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / msPerDay));
}

// ── Safe defaults (match migration defaults) ─────────────────────────────────

const PREMIUM_CONFIG_DEFAULTS: PremiumConfig = {
  premium_enabled: true,
  premium_fee_usdt: 12,
  premium_duration_days: 365,
  premium_badge_name: "Premium Farmer",
  premium_badge_color: "#F5C518",
  premium_farming_bonus_pct: 0.5,
  referral_gen2_pct: 0,
  referral_gen3_pct: 0,
  withdrawal_fee_premium_pct: 2,
};

const PREMIUM_CONFIG_COLUMNS =
  "premium_enabled, premium_fee_usdt, premium_duration_days, premium_badge_name, premium_badge_color, premium_farming_bonus_pct, referral_gen2_pct, referral_gen3_pct, withdrawal_fee_premium_pct";

// Public — no authentication required.
// Reads all PremiumConfig fields from app_settings; returns safe defaults if
// the row is missing (e.g. fresh schema, seed not yet applied).
export const getPremiumConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<PremiumConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select(PREMIUM_CONFIG_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return PREMIUM_CONFIG_DEFAULTS;
    // Numeric columns arrive as strings from PostgREST; normalize to numbers.
    return {
      premium_enabled: data.premium_enabled ?? PREMIUM_CONFIG_DEFAULTS.premium_enabled,
      premium_fee_usdt:
        data.premium_fee_usdt != null
          ? Number(data.premium_fee_usdt)
          : PREMIUM_CONFIG_DEFAULTS.premium_fee_usdt,
      premium_duration_days:
        data.premium_duration_days != null
          ? Number(data.premium_duration_days)
          : PREMIUM_CONFIG_DEFAULTS.premium_duration_days,
      premium_badge_name:
        data.premium_badge_name ?? PREMIUM_CONFIG_DEFAULTS.premium_badge_name,
      premium_badge_color:
        data.premium_badge_color ?? PREMIUM_CONFIG_DEFAULTS.premium_badge_color,
      premium_farming_bonus_pct:
        data.premium_farming_bonus_pct != null
          ? Number(data.premium_farming_bonus_pct)
          : PREMIUM_CONFIG_DEFAULTS.premium_farming_bonus_pct,
      referral_gen2_pct:
        data.referral_gen2_pct != null
          ? Number(data.referral_gen2_pct)
          : PREMIUM_CONFIG_DEFAULTS.referral_gen2_pct,
      referral_gen3_pct:
        data.referral_gen3_pct != null
          ? Number(data.referral_gen3_pct)
          : PREMIUM_CONFIG_DEFAULTS.referral_gen3_pct,
      withdrawal_fee_premium_pct:
        data.withdrawal_fee_premium_pct != null
          ? Number(data.withdrawal_fee_premium_pct)
          : PREMIUM_CONFIG_DEFAULTS.withdrawal_fee_premium_pct,
    };
  },
);

// ── Authenticated server functions ────────────────────────────────────────────

const PREMIUM_STATUS_PROFILE_COLUMNS =
  "membership_tier, premium_expires_at, premium_badge";

const PREMIUM_STATUS_SETTINGS_COLUMNS =
  "premium_badge_name, premium_badge_color, premium_farming_bonus_pct, referral_gen2_pct, referral_gen3_pct, withdrawal_fee_premium_pct, maintenance_ref_gen1_pct, maintenance_ref_gen2_pct, maintenance_ref_gen3_pct";

// Safe defaults for app_settings benefits fields (matches migration defaults).
const BENEFITS_DEFAULTS: PremiumBenefitsSnapshot = {
  farming_bonus_pct: 0.5,
  referral_gen2_pct: 0,
  referral_gen3_pct: 0,
  withdrawal_fee_premium_pct: 2,
  maintenance_ref_gen1_pct: 0,
  maintenance_ref_gen2_pct: 0,
  maintenance_ref_gen3_pct: 0,
};

// Authenticated. Reads the current user's premium status from `profiles` and
// the current benefits snapshot from `app_settings`. Applies inline expiry:
// if days_left <= 0 the returned tier is coerced to 'standard' without waiting
// for the nightly fn_expire_premium job (Requirements 4.4, 4.5).
//
// Validates: Requirements 4.4, 4.5, 11.1
export const getPremiumStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PremiumStatus> => {
    // Fetch profile row for the current user.
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select(PREMIUM_STATUS_PROFILE_COLUMNS)
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    // Fetch app_settings benefits snapshot.
    const { data: settings, error: settingsError } = await context.supabase
      .from("app_settings")
      .select(PREMIUM_STATUS_SETTINGS_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (settingsError) throw new Error(settingsError.message);

    // Build the benefits snapshot, falling back to safe defaults for any null.
    const benefits: PremiumBenefitsSnapshot = {
      farming_bonus_pct:
        settings?.premium_farming_bonus_pct != null
          ? Number(settings.premium_farming_bonus_pct)
          : BENEFITS_DEFAULTS.farming_bonus_pct,
      referral_gen2_pct:
        settings?.referral_gen2_pct != null
          ? Number(settings.referral_gen2_pct)
          : BENEFITS_DEFAULTS.referral_gen2_pct,
      referral_gen3_pct:
        settings?.referral_gen3_pct != null
          ? Number(settings.referral_gen3_pct)
          : BENEFITS_DEFAULTS.referral_gen3_pct,
      withdrawal_fee_premium_pct:
        settings?.withdrawal_fee_premium_pct != null
          ? Number(settings.withdrawal_fee_premium_pct)
          : BENEFITS_DEFAULTS.withdrawal_fee_premium_pct,
      maintenance_ref_gen1_pct:
        settings?.maintenance_ref_gen1_pct != null
          ? Number(settings.maintenance_ref_gen1_pct)
          : BENEFITS_DEFAULTS.maintenance_ref_gen1_pct,
      maintenance_ref_gen2_pct:
        settings?.maintenance_ref_gen2_pct != null
          ? Number(settings.maintenance_ref_gen2_pct)
          : BENEFITS_DEFAULTS.maintenance_ref_gen2_pct,
      maintenance_ref_gen3_pct:
        settings?.maintenance_ref_gen3_pct != null
          ? Number(settings.maintenance_ref_gen3_pct)
          : BENEFITS_DEFAULTS.maintenance_ref_gen3_pct,
    };

    // Badge values: prefer the snapshot stored on the profile at upgrade time;
    // fall back to current app_settings values for users who haven't upgraded yet.
    const badge_name =
      profile?.premium_badge ??
      settings?.premium_badge_name ??
      PREMIUM_CONFIG_DEFAULTS.premium_badge_name;
    const badge_color =
      settings?.premium_badge_color ?? PREMIUM_CONFIG_DEFAULTS.premium_badge_color;

    // Compute days_left via the pure helper (Requirements 4.4).
    const expires_at = profile?.premium_expires_at ?? null;
    const days_left = computeDaysLeft(expires_at);

    // Inline expiry: treat the user as standard when days_left <= 0 regardless
    // of the DB tier value (Requirements 4.4, 4.5).
    const dbTier = (profile?.membership_tier as MembershipTier) ?? "standard";
    const tier: MembershipTier = days_left <= 0 ? "standard" : dbTier;

    return {
      tier,
      expires_at,
      days_left: tier === "standard" ? 0 : days_left,
      badge_name,
      badge_color,
      benefits,
    };
  });

// Authenticated. Calls the `fn_upgrade_to_premium` Supabase RPC and returns
// the updated PremiumStatus on success, or a typed PremiumError on failure.
//
// Known typed error messages returned from the DB function:
//   - 'Insufficient Primary Wallet balance'
//   - 'Premium membership upgrades are currently disabled'
//
// All other DB errors are surfaced as a PremiumError with the raw message.
//
// Validates: Requirements 3.4, 3.5, 3.6, 3.7, 3.9, 11.3
export const upgradeToPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PremiumStatus | PremiumError> => {
    try {
      const { error: rpcError } = await context.supabase.rpc(
        "fn_upgrade_to_premium",
        { p_user_id: context.userId },
      );

      if (rpcError) {
        // Surface DB-raised exceptions as typed PremiumError objects
        // rather than throwing, so callers get a discriminated union.
        return { error: rpcError.message };
      }

      // On success, fetch and return the fresh premium status so the caller
      // gets an up-to-date view without a separate round trip.
      return getPremiumStatus();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return { error: message };
    }
  });

// ── Admin server functions ────────────────────────────────────────────────────
// All five functions below require the caller to hold the `admin` role.
// They use the service-role Supabase client (supabaseAdmin) for writes that
// are restricted to service_role by RLS, and the user-scoped client
// (context.supabase) for the role check so the RLS check is authoritative.

// Lazily-loaded service-role client — same pattern as admin.functions.ts.
async function premiumAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Reusable admin guard — throws "Admin only" when the caller lacks the role.
async function ensurePremiumAdmin(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Admin only");
}

const ADMIN_SETTINGS_COLUMNS =
  "premium_enabled, premium_fee_usdt, premium_duration_days, premium_badge_name, premium_badge_color, " +
  "premium_farming_bonus_pct, referral_gen2_pct, referral_gen3_pct, withdrawal_fee_premium_pct, " +
  "withdrawal_fee_standard_pct, maintenance_ref_gen1_pct, maintenance_ref_gen2_pct, maintenance_ref_gen3_pct";

// ── adminGetPremiumSettings ───────────────────────────────────────────────────
// GET — admin only.
// Returns all PremiumAdminSettings fields from app_settings.
//
// Validates: Requirements 11.4
export const adminGetPremiumSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PremiumAdminSettings> => {
    await ensurePremiumAdmin(context.supabase as Parameters<typeof ensurePremiumAdmin>[0], context.userId);
    const sb = await premiumAdminDb();
    const { data, error } = await sb
      .from("app_settings")
      .select(ADMIN_SETTINGS_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Settings not found");
    return {
      // PremiumConfig fields
      premium_enabled: data.premium_enabled ?? true,
      premium_fee_usdt: Number(data.premium_fee_usdt),
      premium_duration_days: Number(data.premium_duration_days),
      premium_badge_name: data.premium_badge_name ?? "Premium Farmer",
      premium_badge_color: data.premium_badge_color ?? "#F5C518",
      premium_farming_bonus_pct: Number(data.premium_farming_bonus_pct),
      referral_gen2_pct: Number(data.referral_gen2_pct),
      referral_gen3_pct: Number(data.referral_gen3_pct),
      withdrawal_fee_premium_pct: Number(data.withdrawal_fee_premium_pct),
      // PremiumAdminSettings extras
      withdrawal_fee_standard_pct: Number(data.withdrawal_fee_standard_pct),
      maintenance_ref_gen1_pct: Number(data.maintenance_ref_gen1_pct),
      maintenance_ref_gen2_pct: Number(data.maintenance_ref_gen2_pct),
      maintenance_ref_gen3_pct: Number(data.maintenance_ref_gen3_pct),
    };
  });

// ── adminUpdatePremiumSettings ────────────────────────────────────────────────
// POST — admin only.
// Validates all fields before writing. Returns field-level errors on violation
// without persisting anything. On success: atomically writes to app_settings
// and records an admin_audit_log entry.
//
// Validates: Requirements 11.5, 2.16, 15.5

export type SettingsValidationError = { field: string; message: string };

export function validatePremiumSettingsInput(
  input: PremiumAdminSettingsInput,
): SettingsValidationError[] {
  const errors: SettingsValidationError[] = [];

  if (input.premium_fee_usdt < 0) {
    errors.push({ field: "premium_fee_usdt", message: "Fee must be ≥ 0" });
  }
  if (input.premium_duration_days < 1) {
    errors.push({ field: "premium_duration_days", message: "Duration must be ≥ 1 day" });
  }

  const percentageFields: Array<{ key: keyof PremiumAdminSettingsInput; label: string }> = [
    { key: "premium_farming_bonus_pct", label: "Farming bonus" },
    { key: "withdrawal_fee_standard_pct", label: "Standard withdrawal fee" },
    { key: "withdrawal_fee_premium_pct", label: "Premium withdrawal fee" },
    { key: "referral_gen2_pct", label: "Gen2 referral" },
    { key: "referral_gen3_pct", label: "Gen3 referral" },
    { key: "maintenance_ref_gen1_pct", label: "Maintenance ref Gen1" },
    { key: "maintenance_ref_gen2_pct", label: "Maintenance ref Gen2" },
    { key: "maintenance_ref_gen3_pct", label: "Maintenance ref Gen3" },
  ];

  for (const { key, label } of percentageFields) {
    const value = input[key] as number;
    if (typeof value === "number" && (value < 0 || value > 100)) {
      errors.push({
        field: key,
        message: `${label} percentage must be between 0 and 100`,
      });
    }
  }

  return errors;
}

export const adminUpdatePremiumSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as PremiumAdminSettingsInput)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true } | { errors: SettingsValidationError[] }> => {
      await ensurePremiumAdmin(
        context.supabase as Parameters<typeof ensurePremiumAdmin>[0],
        context.userId,
      );

      // Validate first — no DB write if any field is invalid.
      const validationErrors = validatePremiumSettingsInput(data);
      if (validationErrors.length > 0) {
        return { errors: validationErrors };
      }

      const sb = await premiumAdminDb();

      // Atomic write to app_settings (service_role bypasses RLS).
      const { error: updateError } = await sb
        .from("app_settings")
        .update({
          premium_enabled: data.premium_enabled,
          premium_fee_usdt: data.premium_fee_usdt,
          premium_duration_days: data.premium_duration_days,
          premium_badge_name: data.premium_badge_name,
          premium_badge_color: data.premium_badge_color,
          premium_farming_bonus_pct: data.premium_farming_bonus_pct,
          referral_gen2_pct: data.referral_gen2_pct,
          referral_gen3_pct: data.referral_gen3_pct,
          withdrawal_fee_premium_pct: data.withdrawal_fee_premium_pct,
          withdrawal_fee_standard_pct: data.withdrawal_fee_standard_pct,
          maintenance_ref_gen1_pct: data.maintenance_ref_gen1_pct,
          maintenance_ref_gen2_pct: data.maintenance_ref_gen2_pct,
          maintenance_ref_gen3_pct: data.maintenance_ref_gen3_pct,
        })
        .eq("id", true);
      if (updateError) throw new Error(updateError.message);

      // Record audit log entry (best-effort; the settings write is the source of truth).
      await sb.from("admin_audit_log").insert({
        actor_id: context.userId,
        action: "premium_settings_updated",
        target_type: "app_settings",
        target_id: null,
        detail: data as unknown as Record<string, unknown>,
      });

      return { ok: true };
    },
  );

// ── adminGetPremiumMetrics ────────────────────────────────────────────────────
// GET — admin only.
// Returns aggregated PremiumMetrics: counts, conversion rate, revenue, and
// the top-10 users by total referral commissions (ledger_entries kind IN
// ('maintenance_ref_reward', 'affiliate_commission')).
//
// Validates: Requirements 11.6
export const adminGetPremiumMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PremiumMetrics> => {
    await ensurePremiumAdmin(
      context.supabase as Parameters<typeof ensurePremiumAdmin>[0],
      context.userId,
    );
    const sb = await premiumAdminDb();

    // Fetch all membership tier counts in one query.
    const { data: tierRows, error: tierError } = await sb
      .from("profiles")
      .select("membership_tier");
    if (tierError) throw new Error(tierError.message);

    const premiumTiers = new Set(["premium", "gold", "platinum"]);
    let premiumCount = 0;
    let standardCount = 0;
    for (const row of tierRows ?? []) {
      if (premiumTiers.has(row.membership_tier as string)) {
        premiumCount++;
      } else {
        standardCount++;
      }
    }
    const totalUsers = premiumCount + standardCount;
    const conversionRate = totalUsers > 0 ? premiumCount / totalUsers : 0;

    // Total revenue from premium_upgrades.
    const { data: revenueRows, error: revenueError } = await sb
      .from("premium_upgrades")
      .select("amount_usdt");
    if (revenueError) throw new Error(revenueError.message);
    const totalRevenueUsdt = (revenueRows ?? []).reduce(
      (sum, r) => sum + Number(r.amount_usdt),
      0,
    );

    // Top-10 referrers by total commissions from maintenance_ref_reward and
    // affiliate_commission ledger entries.
    const { data: commissionRows, error: commissionError } = await sb
      .from("ledger_entries")
      .select("user_id, amount")
      .in("kind", ["maintenance_ref_reward", "affiliate_commission"]);
    if (commissionError) throw new Error(commissionError.message);

    // Aggregate per user.
    const commissionMap = new Map<string, number>();
    for (const row of commissionRows ?? []) {
      commissionMap.set(
        row.user_id,
        (commissionMap.get(row.user_id) ?? 0) + Number(row.amount),
      );
    }

    // Sort descending and take top 10.
    const top10UserIds = Array.from(commissionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId]) => userId);

    // Fetch display names for the top-10.
    const profileMap = new Map<string, { display_name: string | null; username: string | null }>();
    if (top10UserIds.length > 0) {
      const { data: profiles, error: profileError } = await sb
        .from("profiles")
        .select("id, display_name, username")
        .in("id", top10UserIds);
      if (profileError) throw new Error(profileError.message);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { display_name: p.display_name, username: p.username });
      }
    }

    const topReferrers = top10UserIds.map((userId) => ({
      user_id: userId,
      display_name: profileMap.get(userId)?.display_name ?? null,
      username: profileMap.get(userId)?.username ?? null,
      total_commissions: commissionMap.get(userId) ?? 0,
    }));

    return {
      premium_count: premiumCount,
      standard_count: standardCount,
      conversion_rate: conversionRate,
      total_revenue_usdt: totalRevenueUsdt,
      top_referrers: topReferrers,
    };
  });

// ── adminGrantPremium ─────────────────────────────────────────────────────────
// POST — admin only.
// Grants premium membership for `days` days without charging the user's wallet.
// Inserts a premium_upgrades row with amount_usdt = 0 and updates the profile.
// Records an admin_audit_log entry.
//
// Validates: Requirements 11.7, 15.6
export const adminGrantPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const input = d as { userId: string; days: number };
    if (!input.userId || typeof input.userId !== "string") throw new Error("userId is required");
    if (!input.days || typeof input.days !== "number" || input.days < 1)
      throw new Error("days must be a positive integer");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensurePremiumAdmin(
      context.supabase as Parameters<typeof ensurePremiumAdmin>[0],
      context.userId,
    );
    const sb = await premiumAdminDb();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000);

    // Fetch current badge name from settings (for the profile snapshot).
    const { data: settingsRow } = await sb
      .from("app_settings")
      .select("premium_badge_name")
      .eq("id", true)
      .maybeSingle();
    const badgeName = settingsRow?.premium_badge_name ?? "Premium Farmer";

    // Insert premium_upgrades row with amount_usdt = 0.
    const { error: upgradeError } = await sb.from("premium_upgrades").insert({
      user_id: data.userId,
      amount_usdt: 0,
      paid_from_wallet: "primary",
      tier: "premium",
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
    if (upgradeError) throw new Error(upgradeError.message);

    // Update profile: set membership_tier, premium_activated_at, premium_expires_at, premium_badge.
    const { error: profileError } = await sb
      .from("profiles")
      .update({
        membership_tier: "premium",
        premium_activated_at: now.toISOString(),
        premium_expires_at: expiresAt.toISOString(),
        premium_badge: badgeName,
      })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    // Record admin_audit_log entry.
    await sb.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "premium_granted",
      target_type: "profile",
      target_id: data.userId,
      detail: { days: data.days, expires_at: expiresAt.toISOString() },
    });

    return { ok: true };
  });

// ── adminRevokePremium ────────────────────────────────────────────────────────
// POST — admin only.
// Immediately revokes premium by setting membership_tier = 'standard' and
// clearing premium_expires_at. Records an admin_audit_log entry.
//
// Validates: Requirements 11.8, 15.6
export const adminRevokePremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const input = d as { userId: string };
    if (!input.userId || typeof input.userId !== "string") throw new Error("userId is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await ensurePremiumAdmin(
      context.supabase as Parameters<typeof ensurePremiumAdmin>[0],
      context.userId,
    );
    const sb = await premiumAdminDb();

    // Set membership_tier = 'standard', clear premium_expires_at.
    const { error: profileError } = await sb
      .from("profiles")
      .update({
        membership_tier: "standard",
        premium_expires_at: null,
      })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    // Record admin_audit_log entry.
    await sb.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "premium_revoked",
      target_type: "profile",
      target_id: data.userId,
      detail: { revoked_at: new Date().toISOString() },
    });

    return { ok: true };
  });
