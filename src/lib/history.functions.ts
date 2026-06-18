import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type LedgerKind = Database["public"]["Enums"]["ledger_kind"];
export type WalletKind = Database["public"]["Enums"]["wallet_kind"];

export type LedgerEntry = {
  id: string;
  wallet_kind: WalletKind;
  kind: LedgerKind;
  amount: number;
  balance_after: number;
  memo: string | null;
  created_at: string;
};

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(25),
  sortBy: z.enum(["created_at", "amount"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  wallet: z.enum(["primary", "farming", "all"]).default("all"),
  kind: z.string().optional(),
});

export const listLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(
    async ({ data, context }): Promise<{ rows: LedgerEntry[]; total: number }> => {
      const { supabase, userId } = context;

      // Resolve wallet filter to wallet_id(s)
      let walletIds: string[] | null = null;
      const { data: wallets, error: wErr } = await supabase
        .from("wallets")
        .select("id, kind")
        .eq("user_id", userId);
      if (wErr) throw new Error(wErr.message);
      const walletMap = new Map<string, WalletKind>();
      for (const w of wallets ?? []) walletMap.set(w.id, w.kind as WalletKind);
      if (data.wallet !== "all") {
        walletIds = (wallets ?? [])
          .filter((w) => w.kind === data.wallet)
          .map((w) => w.id);
        if (walletIds.length === 0) return { rows: [], total: 0 };
      }

      const from = (data.page - 1) * data.pageSize;
      const to = from + data.pageSize - 1;

      let q = supabase
        .from("ledger_entries")
        .select("id, wallet_id, kind, amount, balance_after, memo, created_at", {
          count: "exact",
        })
        .eq("user_id", userId)
        .order(data.sortBy, { ascending: data.sortDir === "asc" })
        .range(from, to);
      if (walletIds) q = q.in("wallet_id", walletIds);
      if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind as LedgerKind);

      const { data: rows, error, count } = await q;
      if (error) throw new Error(error.message);

      return {
        rows: (rows ?? []).map((r) => ({
          id: r.id,
          wallet_kind: walletMap.get(r.wallet_id as string) ?? "primary",
          kind: r.kind as LedgerKind,
          amount: Number(r.amount),
          balance_after: Number(r.balance_after),
          memo: r.memo,
          created_at: r.created_at as string,
        })),
        total: count ?? 0,
      };
    },
  );