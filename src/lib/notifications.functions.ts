import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  ref_table: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
};

// Paginated list of the caller's notifications, newest first. RLS limits the
// query to the caller's own rows, so no explicit user filter is required, but
// we add one anyway for clarity/defence-in-depth.
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(100).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<NotificationRow[]> => {
    const { supabase, userId } = context;
    const limit = data?.limit ?? 50;
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, ref_table, ref_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Lightweight unread count for the topbar bell badge.
export const getUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { supabase, userId } = context;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

// Mark a single notification read (owner-gated inside the RPC).
export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_notification_read", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Mark every unread notification read; returns how many were updated.
export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ updated: number }> => {
    const { data, error } = await context.supabase.rpc("mark_all_notifications_read");
    if (error) throw new Error(error.message);
    return { updated: Number(data ?? 0) };
  });
