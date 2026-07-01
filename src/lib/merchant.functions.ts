import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Types ────────────────────────────────────────────────────────────────

export type MerchantProfile = {
  id: string;
  business_name: string;
  contact_name: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
};

export type MerchantWallet = {
  balance: number;   // USDT
  locked: number;
};

export type MerchantLedgerRow = {
  id: string;
  kind: string;
  amount: number;
  memo: string | null;
  created_at: string;
};

// ─── Register merchant (called after email signup) ─────────────────────────

const registerInput = z.object({
  businessName: z.string().min(1).max(120).trim(),
  contactName:  z.string().min(1).max(120).trim(),
  phone:   z.string().max(40).optional(),
  city:    z.string().max(80).optional(),
  country: z.string().max(80).optional(),
});

export const registerMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("register_merchant", {
      p_business_name: data.businessName,
      p_contact_name:  data.contactName,
      p_phone:   data.phone ?? null,
      p_city:    data.city ?? null,
      p_country: data.country ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Get own merchant profile ───────────────────────────────────────────────

export const getMyMerchantProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchantProfile | null> => {
    const { data, error } = await context.supabase
      .from("merchant_profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as MerchantProfile | null;
  });

// ─── Update merchant profile ────────────────────────────────────────────────

const updateProfileInput = z.object({
  businessName: z.string().min(1).max(120).trim(),
  contactName:  z.string().min(1).max(120).trim(),
  phone:   z.string().max(40).optional(),
  city:    z.string().max(80).optional(),
  country: z.string().max(80).optional(),
});

export const updateMerchantProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("merchant_profiles")
      .update({
        business_name: data.businessName,
        contact_name:  data.contactName,
        phone:   data.phone ?? null,
        city:    data.city ?? null,
        country: data.country ?? null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Get merchant wallet balance ────────────────────────────────────────────

export const getMerchantWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchantWallet> => {
    const { data, error } = await context.supabase
      .from("wallets")
      .select("balance, locked")
      .eq("user_id", context.userId)
      .eq("kind", "primary")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      balance: Number(data?.balance ?? 0),
      locked:  Number(data?.locked ?? 0),
    };
  });

// ─── Get merchant ledger ────────────────────────────────────────────────────

export const getMerchantLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchantLedgerRow[]> => {
    const { data, error } = await context.supabase
      .from("ledger_entries")
      .select("id, kind, amount, memo, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind as string,
      amount: Number(e.amount),
      memo: e.memo,
      created_at: e.created_at,
    }));
  });

// ─── Transfer USDT to farmer's farming wallet ───────────────────────────────

const transferInput = z.object({
  farmerId:    z.string().uuid(),
  amountUsdt:  z.number().positive().max(1_000_000_000),
  note:        z.string().max(200).optional(),
});

export const merchantTransferToFarmer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => transferInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("merchant_transfer_to_farmer", {
      p_farmer_id:   data.farmerId,
      p_amount_usdt: data.amountUsdt,
      p_note:        data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

// ─── Redeem coupon (credits USDT to merchant primary wallet) ────────────────

const redeemInput = z.object({ code: z.string().min(1).max(64) });

export const merchantRedeemCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => redeemInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("redeem_coupon", {
      p_code: data.code,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Check merchant role ────────────────────────────────────────────────────

export const checkIsMerchant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isMerchant: boolean }> => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "merchant")
      .maybeSingle();
    return { isMerchant: !!data };
  });

// ─── Lookup farmer by handle (for transfer) ────────────────────────────────

export const lookupFarmerForMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }): Promise<{
    id: string; display_name: string | null; username: string | null; avatar_url: string | null;
  } | null> => {
    const rpc = await context.supabase.rpc("find_profile_by_handle", { handle: data.handle.trim() });
    if (rpc.error) return null;
    const r = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    if (!r || r.id === context.userId) return null;
    return { id: r.id, display_name: r.display_name, username: r.username, avatar_url: r.avatar_url };
  });
