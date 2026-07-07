/**
 * Achievement Rewards — server functions
 *
 * getAchievementRewards   — public (authenticated); returns all reward configs +
 *                           which ones the current user has already claimed.
 * adminGetAchievementRewards / adminUpdateAchievementReward — admin-only CRUD.
 * claimAchievementReward  — authenticated; calls fn_claim_achievement RPC.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Types ──────────────────────────────────────────────────────────────────

export type AchievementReward = {
  achievement_id: string;
  title: string;
  description: string;
  category: string;
  pv_reward: number;
  usdt_reward: number;
  enabled: boolean;
};

export type AchievementRewardWithClaim = AchievementReward & {
  claimed: boolean;
};

// ── Public: load rewards + claim status for current user ──────────────────

export const getAchievementRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AchievementRewardWithClaim[]> => {
    const { supabase, userId } = context;

    const [{ data: rewards }, { data: claims }] = await Promise.all([
      supabase
        .from("achievement_rewards")
        .select("achievement_id, title, description, category, pv_reward, usdt_reward, enabled")
        .order("category")
        .order("achievement_id"),
      supabase
        .from("achievement_claims")
        .select("achievement_id")
        .eq("user_id", userId),
    ]);

    const claimedSet = new Set((claims ?? []).map((c) => c.achievement_id));

    return (rewards ?? []).map((r) => ({
      achievement_id: r.achievement_id,
      title: r.title,
      description: r.description ?? "",
      category: r.category,
      pv_reward: Number(r.pv_reward),
      usdt_reward: Number(r.usdt_reward),
      enabled: r.enabled,
      claimed: claimedSet.has(r.achievement_id),
    }));
  });

// ── Claim a reward ─────────────────────────────────────────────────────────

export const claimAchievementReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ achievementId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("fn_claim_achievement", {
      p_user_id: context.userId,
      p_achievement_id: data.achievementId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Admin: list all rewards ────────────────────────────────────────────────

export const adminGetAchievementRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AchievementReward[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { data, error } = await context.supabase
      .from("achievement_rewards")
      .select("achievement_id, title, description, category, pv_reward, usdt_reward, enabled")
      .order("category")
      .order("achievement_id");

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      achievement_id: r.achievement_id,
      title: r.title,
      description: r.description ?? "",
      category: r.category,
      pv_reward: Number(r.pv_reward),
      usdt_reward: Number(r.usdt_reward),
      enabled: r.enabled,
    }));
  });

// ── Admin: update a single reward ─────────────────────────────────────────

export const adminUpdateAchievementReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      achievement_id: z.string().min(1),
      pv_reward: z.number().min(0),
      usdt_reward: z.number().min(0),
      enabled: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("achievement_rewards")
      .update({
        pv_reward: data.pv_reward,
        usdt_reward: data.usdt_reward,
        enabled: data.enabled,
      })
      .eq("achievement_id", data.achievement_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
