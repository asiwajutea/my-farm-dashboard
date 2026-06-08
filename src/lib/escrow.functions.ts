import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { RecipientPreview } from "@/lib/p2p.functions";

export type EscrowStatus =
  | "pending"
  | "accepted"
  | "released"
  | "cancelled"
  | "disputed"
  | "refunded";

export type EscrowRole = "payer" | "payee";

export type EscrowTrade = {
  id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  title: string | null;
  terms: string | null;
  status: EscrowStatus;
  dispute_reason: string | null;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  // Derived for the viewer:
  role: EscrowRole;
  counterparty: RecipientPreview | null;
};

type EscrowRow = {
  id: string;
  payer_id: string;
  payee_id: string;
  amount: number | string;
  title: string | null;
  terms: string | null;
  status: EscrowStatus;
  dispute_reason: string | null;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

const ESCROW_COLUMNS =
  "id, payer_id, payee_id, amount, title, terms, status, dispute_reason, resolution, resolved_by, created_at, updated_at";

// Resolve counterparty profile previews for a set of escrow rows, keyed by the
// viewer's role on each row.
async function attachCounterparties(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: EscrowRow[],
): Promise<EscrowTrade[]> {
  const counterpartyIds = Array.from(
    new Set(rows.map((r) => (r.payer_id === userId ? r.payee_id : r.payer_id))),
  );
  const profileMap = new Map<string, RecipientPreview>();
  if (counterpartyIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, referral_code")
      .in("id", counterpartyIds);
    for (const p of profs ?? []) profileMap.set(p.id, p as RecipientPreview);
  }
  return rows.map((r) => {
    const role: EscrowRole = r.payer_id === userId ? "payer" : "payee";
    const counterpartyId = role === "payer" ? r.payee_id : r.payer_id;
    return {
      ...r,
      amount: Number(r.amount),
      role,
      counterparty: profileMap.get(counterpartyId) ?? null,
    };
  });
}

export const listMyEscrows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EscrowTrade[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("escrow_trades")
      .select(ESCROW_COLUMNS)
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return attachCounterparties(supabase, userId, (data ?? []) as EscrowRow[]);
  });

const idInput = z.object({ id: z.string().uuid() });

export const getEscrow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<EscrowTrade | null> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("escrow_trades")
      .select(ESCROW_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const [trade] = await attachCounterparties(supabase, userId, [row as EscrowRow]);
    return trade ?? null;
  });

const createInput = z.object({
  payeeId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  title: z.string().max(120).optional(),
  terms: z.string().max(1000).optional(),
});

export const createEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("escrow_create", {
      p_payee_id: data.payeeId,
      p_amount: data.amount,
      p_title: data.title ?? undefined,
      p_terms: data.terms ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

export const acceptEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("escrow_accept", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("escrow_release", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("escrow_cancel", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const disputeInput = z.object({
  id: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

export const disputeEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => disputeInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("escrow_dispute", {
      p_id: data.id,
      p_reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const resolveInput = z.object({
  id: z.string().uuid(),
  release: z.boolean(),
  resolution: z.string().max(1000).optional(),
});

export const resolveEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resolveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("escrow_resolve", {
      p_id: data.id,
      p_release: data.release,
      p_resolution: data.resolution ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
