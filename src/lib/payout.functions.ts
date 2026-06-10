import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PAYOUT_ANCHOR, DEFAULT_PAYOUT_TIMEZONE, type PayoutConfig } from "@/lib/payout";

// Read/write of the bi-weekly payout schedule on the app_settings singleton.
// Reads use the RLS-enforced authenticated client (SELECT is granted to all);
// the write goes through the admin_set_payout SECURITY DEFINER RPC because
// authenticated has no UPDATE privilege on app_settings.

const PAYOUT_COLUMNS = "payout_anchor, payout_lock_enabled, payout_timezone";

/** Read the current payout schedule config. */
export const getPayoutSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutConfig> => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select(PAYOUT_COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      anchor: data?.payout_anchor ?? DEFAULT_PAYOUT_ANCHOR,
      lockEnabled: data?.payout_lock_enabled ?? true,
      timeZone: data?.payout_timezone ?? DEFAULT_PAYOUT_TIMEZONE,
    };
  });

/** True iff `value` is a valid IANA time zone name. */
function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const payoutSchema = z.object({
  // Payouts happen on Fridays, so the anchor must be a Friday.
  anchor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Anchor must be a YYYY-MM-DD date")
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime());
    }, "Anchor is not a valid date")
    .refine((s) => new Date(`${s}T00:00:00Z`).getUTCDay() === 5, "Anchor date must be a Friday"),
  lockEnabled: z.boolean(),
  timeZone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "Unknown time zone"),
});

/** Admin-only update of the payout schedule. */
export const adminUpdatePayoutSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payoutSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("admin_set_payout", {
      p_anchor: data.anchor,
      p_lock_enabled: data.lockEnabled,
      p_timezone: data.timeZone,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
