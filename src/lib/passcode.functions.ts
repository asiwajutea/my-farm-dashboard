import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Must be 6 digits") });
const setSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  currentCode: z.string().regex(/^\d{6}$/).optional(),
});

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export const hasPasscode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ has: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_passcode");
    if (error) throw new Error(error.message);
    return { has: Boolean(data) };
  });

export const setPasscode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const bcrypt = await import("bcryptjs");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_passcodes")
      .select("passcode_hash")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.passcode_hash) {
      if (!data.currentCode) throw new Error("Current passcode required");
      const ok = await bcrypt.compare(data.currentCode, existing.passcode_hash);
      if (!ok) throw new Error("Current passcode incorrect");
    }
    const hash = await bcrypt.hash(data.code, 10);
    const { error } = await supabaseAdmin
      .from("user_passcodes")
      .upsert({ user_id: context.userId, passcode_hash: hash, failed_attempts: 0, locked_until: null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Internal helper — verify a passcode for the given user. Throws on failure. */
export async function verifyPasscodeFor(userId: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid passcode");
  const bcrypt = await import("bcryptjs");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("user_passcodes")
    .select("passcode_hash, failed_attempts, locked_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Set your transaction passcode first");
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    throw new Error("Passcode locked. Try again later.");
  }
  const ok = await bcrypt.compare(code, row.passcode_hash);
  if (!ok) {
    const fails = (row.failed_attempts ?? 0) + 1;
    const lock = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    await supabaseAdmin
      .from("user_passcodes")
      .update({ failed_attempts: fails, locked_until: lock })
      .eq("user_id", userId);
    throw new Error(lock ? "Too many attempts. Locked for 15 minutes." : "Incorrect passcode");
  }
  if ((row.failed_attempts ?? 0) > 0) {
    await supabaseAdmin
      .from("user_passcodes")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("user_id", userId);
  }
}

export const verifyPasscode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await verifyPasscodeFor(context.userId, data.code);
    return { ok: true };
  });