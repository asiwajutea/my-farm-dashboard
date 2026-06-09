import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  getUnreadCount,
  type NotificationRow,
} from "@/lib/notifications.functions";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

/**
 * Subscribes to realtime INSERT/UPDATE on the caller's notifications and
 * invalidates the shared react-query caches so the bell badge and the list
 * stay live. Mounted once high in the authenticated tree.
 */
export function useNotificationsRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);
}

/** Unread count for the topbar bell badge. */
export function useUnreadCount() {
  const fn = useServerFn(getUnreadCount);
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => fn(),
    refetchOnWindowFocus: true,
  });
}

/** Full (paginated) notification list. */
export function useNotificationList(limit = 50) {
  const fn = useServerFn(listNotifications);
  return useQuery<NotificationRow[]>({
    queryKey: [...NOTIFICATIONS_KEY, "list", limit],
    queryFn: () => fn({ data: { limit } }),
  });
}
