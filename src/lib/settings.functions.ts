import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Core platform settings live in the singleton `app_settings` row. The app
// reads these everywhere (conversion rate, fees, cycle params), but until now
// there was no admin write path for them — only the affiliate subset was
// editable. These server fns add a gated read/update for the core fields.

export type PlatformSettings = {
  seed_to_usdt: number;
  min_deposit_seed: number;
  min_withdraw_seed: number;
  withdraw_fee_pct: number;
  p2p_fee_pct: number;
  cycle_duration_days: number;
  cycle_base_reward_pct: number;
  min_cycle_seed: number;
  max_cycle_seed: number;
  referral_bonus_pct: number;
};

const CORE_COLUMNS =
  "seed_to_usdt, min_deposit_seed, min_withdraw_seed, withdraw_fee_pct, p2p_fee_pct, cycle_duration_days, cycle_base_reward_pct, min_cycle_seed, max_cycle_seed, referral_bonus_pct";

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformSettings> => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select(CORE_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Settings not found");
    // Numeric columns arrive as strings from PostgREST; normalize to numbers.
    return {
      seed_to_usdt: Number(data.seed_to_usdt),
      min_deposit_seed: Number(data.min_deposit_seed),
      min_withdraw_seed: Number(data.min_withdraw_seed),
      withdraw_fee_pct: Number(data.withdraw_fee_pct),
      p2p_fee_pct: Number(data.p2p_fee_pct),
      cycle_duration_days: Number(data.cycle_duration_days),
      cycle_base_reward_pct: Number(data.cycle_base_reward_pct),
      min_cycle_seed: Number(data.min_cycle_seed),
      max_cycle_seed: Number(data.max_cycle_seed),
      referral_bonus_pct: Number(data.referral_bonus_pct),
    };
  });

// Percentages are stored as fractions (0.02 = 2%). The numeric(6,4) columns cap
// fractional values at < 100, so percentage inputs of 0–100% map cleanly.
const platformSchema = z
  .object({
    seed_to_usdt: z.number().positive().max(1_000_000),
    min_deposit_seed: z.number().min(0).max(1_000_000_000),
    min_withdraw_seed: z.number().min(0).max(1_000_000_000),
    withdraw_fee_pct: z.number().min(0).max(1),
    p2p_fee_pct: z.number().min(0).max(1),
    cycle_duration_days: z.number().int().min(1).max(3650),
    cycle_base_reward_pct: z.number().min(0).max(1),
    min_cycle_seed: z.number().min(0).max(1_000_000_000),
    max_cycle_seed: z.number().min(0).max(1_000_000_000),
    referral_bonus_pct: z.number().min(0).max(1),
  })
  .refine((s) => s.max_cycle_seed >= s.min_cycle_seed, {
    message: "Max cycle amount must be greater than or equal to min cycle amount",
    path: ["max_cycle_seed"],
  });

export const adminUpdatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => platformSchema.parse(d))
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

export type BoosterRow = {
  id: string;
  code: string;
  label: string;
  duration_hours: number;
  reward_bps: number;
  cost_seed: number;
  active: boolean;
};

// Read-only listing of farming boosters for the admin settings page. Editing
// boosters (CRUD) is intentionally out of scope here.
export const adminListBoosters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BoosterRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");
    const { data, error } = await context.supabase
      .from("boosters")
      .select("id, code, label, duration_hours, reward_bps, cost_seed, active")
      .order("cost_seed", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({
      id: b.id,
      code: b.code,
      label: b.label,
      duration_hours: b.duration_hours,
      reward_bps: b.reward_bps,
      cost_seed: Number(b.cost_seed),
      active: b.active,
    }));
  });
