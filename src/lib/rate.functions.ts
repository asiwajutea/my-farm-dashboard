import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type RatePoint = { t: string; rate: number };

const rangeInput = z.object({
  range: z.enum(["24h", "7d", "30d", "90d", "all"]).default("30d"),
});

export const getRateHistory = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => rangeInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<RatePoint[]> => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    let sinceIso: string | null = null;
    const now = Date.now();
    if (data.range === "24h") sinceIso = new Date(now - 24 * 3600 * 1000).toISOString();
    else if (data.range === "7d") sinceIso = new Date(now - 7 * 86400 * 1000).toISOString();
    else if (data.range === "30d") sinceIso = new Date(now - 30 * 86400 * 1000).toISOString();
    else if (data.range === "90d") sinceIso = new Date(now - 90 * 86400 * 1000).toISOString();

    let query = supabase
      .from("rate_history")
      .select("seed_to_usdt, recorded_at")
      .order("recorded_at", { ascending: true })
      .limit(1000);
    if (sinceIso) query = query.gte("recorded_at", sinceIso);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      t: r.recorded_at as string,
      rate: Number(r.seed_to_usdt),
    }));
  });