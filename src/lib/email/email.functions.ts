/**
 * Server functions for triggering transactional emails.
 * Called from route handlers after key actions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Send welcome email after confirmed signup ───────────────────────────────

export const sendWelcomeEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email) return { ok: false };

    const { sendWelcomeEmail } = await import("./service");
    const result = await sendWelcomeEmail({
      to: email,
      name: prof?.display_name ?? email.split("@")[0],
    });
    return { ok: result.ok };
  });

// ── Send merchant welcome email ─────────────────────────────────────────────

export const sendMerchantWelcomeEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { supabase, userId } = context;

    const { data: mp } = await supabase
      .from("merchant_profiles")
      .select("business_name, contact_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email || !mp) return { ok: false };

    const { sendMerchantWelcomeEmail } = await import("./service");
    const result = await sendMerchantWelcomeEmail({
      to: email,
      businessName: mp.business_name,
      contactName: mp.contact_name,
    });
    return { ok: result.ok };
  });

// ── Admin: send deposit approved email ─────────────────────────────────────

export const sendDepositApprovedEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), amount: z.string() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    // Only admins should call this
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = authUser?.user?.email;
    if (!email) return { ok: false };

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", data.userId)
      .maybeSingle();

    const { sendDepositApprovedEmail } = await import("./service");
    const result = await sendDepositApprovedEmail({
      to: email,
      name: prof?.display_name ?? email.split("@")[0],
      amount: data.amount,
    });
    return { ok: result.ok };
  });
