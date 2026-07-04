import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyPasscodeFor } from "./passcode.functions";

export type PayoutMethod = {
  id: string;
  user_id: string;
  kind: "bank" | "crypto";
  label: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  iban: string | null;
  swift: string | null;
  network: string | null;
  address: string | null;
  memo: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const baseFields = {
  label: z.string().trim().min(1).max(80),
  is_default: z.boolean().optional().default(false),
  passcode: z.string().regex(/^\d{6}$/, "6-digit passcode required"),
};

const bankSchema = z.object({
  kind: z.literal("bank"),
  bank_name: z.string().trim().min(1).max(120),
  account_name: z.string().trim().min(1).max(120),
  account_number: z.string().trim().min(1).max(64),
  routing_number: z.string().trim().max(64).optional().nullable(),
  iban: z.string().trim().max(64).optional().nullable(),
  swift: z.string().trim().max(32).optional().nullable(),
  ...baseFields,
});

const cryptoSchema = z.object({
  kind: z.literal("crypto"),
  network: z.string().trim().min(1).max(32),
  address: z.string().trim().min(6).max(160),
  memo: z.string().trim().max(80).optional().nullable(),
  ...baseFields,
});

const inputSchema = z.discriminatedUnion("kind", [bankSchema, cryptoSchema]);

export const listPayoutMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutMethod[]> => {
    const { data, error } = await context.supabase
      .from("payout_methods")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PayoutMethod[];
  });

export const savePayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await verifyPasscodeFor(context.userId, data.passcode);
    const row =
      data.kind === "bank"
        ? {
            user_id: context.userId,
            kind: "bank" as const,
            label: data.label,
            bank_name: data.bank_name,
            account_name: data.account_name,
            account_number: data.account_number,
            routing_number: data.routing_number ?? null,
            iban: data.iban ?? null,
            swift: data.swift ?? null,
            is_default: data.is_default ?? false,
          }
        : {
            user_id: context.userId,
            kind: "crypto" as const,
            label: data.label,
            network: data.network,
            address: data.address,
            memo: data.memo ?? null,
            is_default: data.is_default ?? false,
          };
    const { data: inserted, error } = await context.supabase
      .from("payout_methods")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deletePayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("payout_methods")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });