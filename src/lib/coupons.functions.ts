import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RedemptionRow = {
  id: string;
  coupon_id: string;
  amount: number;
  redeemed_at: string;
  code: string | null;
};

const codeInput = z.object({ code: z.string().min(1).max(64) });

export const redeemCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("redeem_coupon", {
      p_code: data.code,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

export const listMyRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RedemptionRow[]> => {
    const { data, error } = await context.supabase
      .from("coupon_redemptions")
      .select("id, coupon_id, amount, redeemed_at, coupons(code)")
      .eq("user_id", context.userId)
      .order("redeemed_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      coupon_id: r.coupon_id,
      amount: Number(r.amount),
      redeemed_at: r.redeemed_at,
      code: (r as { coupons?: { code: string } | null }).coupons?.code ?? null,
    }));
  });
