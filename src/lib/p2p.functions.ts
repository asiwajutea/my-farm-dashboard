import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RecipientPreview = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  referral_code: string | null;
};

export type TransferRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  fee: number;
  note: string | null;
  status: string;
  created_at: string;
  direction: "in" | "out";
  counterparty: RecipientPreview | null;
};

const handleInput = z.object({ handle: z.string().min(1).max(64) });

export const lookupRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => handleInput.parse(d))
  .handler(async ({ data, context }): Promise<RecipientPreview | null> => {
    const handle = data.handle.trim();

    // Primary path: dedicated RPC (case-insensitive, matches username or referral code).
    let row: RecipientPreview | null = null;
    const rpc = await context.supabase.rpc("find_profile_by_handle", { handle });
    if (!rpc.error) {
      const r = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      row = (r as RecipientPreview | undefined) ?? null;
    }

    // Fallback: direct service-role lookup so a missing/restricted RPC doesn't break
    // recipient resolution. Sanitize the handle before using it in an `or` filter so
    // user input can't alter the query.
    if (!row) {
      const safe = handle.replace(/[^a-zA-Z0-9_-]/g, "");
      if (safe) {
        const { data: rows, error } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name, username, avatar_url, referral_code")
          .or(`username.ilike.${safe},referral_code.ilike.${safe}`)
          .limit(5);
        if (error) throw new Error(error.message);
        row = (rows ?? []).find((r) => r.id !== context.userId) ?? null;
      }
    }

    if (!row || row.id === context.userId) return null;
    return row;
  });

const sendInput = z.object({
  receiverId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  note: z.string().max(200).optional(),
});

export const sendP2P = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("p2p_send", {
      p_receiver_id: data.receiverId,
      p_amount: data.amount,
      p_note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

export const listMyTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TransferRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("p2p_transfers")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const counterpartyIds = Array.from(
      new Set(rows.map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id))),
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
      const direction: "in" | "out" = r.sender_id === userId ? "out" : "in";
      const counterpartyId = direction === "out" ? r.receiver_id : r.sender_id;
      return {
        ...r,
        amount: Number(r.amount),
        fee: Number(r.fee),
        direction,
        counterparty: profileMap.get(counterpartyId) ?? null,
      };
    });
  });

export const getP2PFeePct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ feePct: number }> => {
    const { data } = await context.supabase.from("app_settings").select("p2p_fee_pct").maybeSingle();
    return { feePct: Number(data?.p2p_fee_pct ?? 0) };
  });
