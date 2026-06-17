import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type Booster = Database["public"]["Tables"]["boosters"]["Row"];
export type Cycle = Database["public"]["Tables"]["cycles"]["Row"];

export const listBoosters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Booster[]> => {
    const { data, error } = await context.supabase
      .from("boosters")
      .select("*")
      .eq("active", true)
      .order("duration_hours", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Cycle[]> => {
    const { data, error } = await context.supabase
      .from("cycles")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const startInput = z.object({
  boosterId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
});

export const startCycleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => startInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("start_cycle", {
      p_booster_id: data.boosterId,
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

const reapInput = z.object({ cycleId: z.string().uuid() });

export const reapCycleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reapInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("reap_cycle", { p_cycle_id: data.cycleId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFarmingBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ balance: number; locked: number }> => {
    const { data, error } = await context.supabase
      .from("wallets")
      .select("balance, locked")
      .eq("user_id", context.userId)
      .eq("kind", "farming")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { balance: Number(data?.balance ?? 0), locked: Number(data?.locked ?? 0) };
  });

const transferInput = z.object({ amount: z.number().positive().max(1_000_000_000) });

export const transferToFarmingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => transferInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("transfer_to_farming", {
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
