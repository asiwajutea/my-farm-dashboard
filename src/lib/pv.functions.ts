import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type PvActivity = Database["public"]["Tables"]["pv_activities"]["Row"];
export type PvLedgerRow = Database["public"]["Tables"]["pv_ledger"]["Row"];

export const listPvActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PvActivity[]> => {
    const { data, error } = await context.supabase
      .from("pv_activities")
      .select("*")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertInput = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  self: z.number().min(0),
  g1: z.number().min(0),
  g2: z.number().min(0),
  g3: z.number().min(0),
  active: z.boolean(),
});

export const upsertPvActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_upsert_pv_activity", {
      p_code: data.code,
      p_label: data.label,
      p_description: data.description ?? null,
      p_self: data.self,
      p_g1: data.g1,
      p_g2: data.g2,
      p_g3: data.g3,
      p_active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPvSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ total: number; recent: PvLedgerRow[] }> => {
    const { data, error } = await context.supabase
      .from("pv_ledger")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const { data: totalRows } = await context.supabase
      .from("pv_ledger")
      .select("points")
      .eq("user_id", context.userId);
    const total = (totalRows ?? []).reduce((s, r) => s + Number(r.points), 0);
    return { total, recent: data ?? [] };
  });