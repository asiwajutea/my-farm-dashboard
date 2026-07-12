import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Maintenance mode state — globally toggleable + per-page togglable. Admins
// always bypass; registration (/auth) and the landing page stay reachable.

export type MaintenanceState = {
  global: boolean;
  message: string;
  pages: Record<string, boolean>;
  ticker_enabled: boolean;
  ticker_items: { icon: string; label: string }[];
  telegram_group_url:   string | null;
  telegram_channel_url: string | null;
};

// Public read — used by the public landing page (ticker) and by the
// authenticated shell (maintenance gate). Bypasses RLS so unauthenticated
// visitors can still see the marquee.
export const getPublicSiteState = createServerFn({ method: "GET" }).handler(
  async (): Promise<MaintenanceState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("maint_mode_global, maint_message, maint_pages, ticker_enabled, ticker_items, telegram_group_url, telegram_channel_url")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const pages = (data?.maint_pages ?? {}) as Record<string, boolean>;
    const items = Array.isArray(data?.ticker_items)
      ? (data!.ticker_items as { icon: string; label: string }[])
      : [];
    return {
      global: !!data?.maint_mode_global,
      message: data?.maint_message ?? "We'll be back shortly.",
      pages,
      ticker_enabled: data?.ticker_enabled ?? true,
      ticker_items: items,
      telegram_group_url:   (data as Record<string, unknown>)?.telegram_group_url as string | null ?? null,
      telegram_channel_url: (data as Record<string, unknown>)?.telegram_channel_url as string | null ?? null,
    };
  },
);

const maintInput = z.object({
  global: z.boolean(),
  message: z.string().trim().max(500),
  pages: z.record(z.string().min(1).max(40), z.boolean()),
});

export const adminSetMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => maintInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_maintenance", {
      p_global: data.global,
      p_message: data.message,
      p_pages: data.pages,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const tickerInput = z.object({
  enabled: z.boolean(),
  items: z
    .array(
      z.object({
        icon: z.string().min(1).max(40),
        label: z.string().trim().min(1).max(120),
      }),
    )
    .max(40),
});

export const adminSetTicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tickerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_ticker", {
      p_enabled: data.enabled,
      p_items: data.items,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Admin: update social community links ─────────────────────────────────

export const adminSetSocialLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      telegram_group_url:   z.string().url().max(500).nullable().or(z.literal("")),
      telegram_channel_url: z.string().url().max(500).nullable().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({
        telegram_group_url:   data.telegram_group_url || null,
        telegram_channel_url: data.telegram_channel_url || null,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
