import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/notifications.functions";
import {
  useNotificationList,
  useNotificationsRealtime,
  NOTIFICATIONS_KEY,
} from "@/hooks/use-notifications";
import { notificationMeta, relativeTime } from "@/lib/notification-meta";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · VFarmers" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  useNotificationsRealtime();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listQ = useNotificationList(100);

  const markReadFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const markRead = useMutation({
    mutationFn: (id: string) => markReadFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      toast.success(r.updated > 0 ? `Marked ${r.updated} as read.` : "All caught up.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = listQ.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const onOpen = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate(n.id);
    const meta = notificationMeta(n.kind);
    if (meta.to) navigate({ to: meta.to });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cycle reaps, transfers, deposits, escrow updates and commissions — in real time.
          </p>
        </div>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending || unread === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
        >
          {markAll.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCheck className="h-3.5 w-3.5" />
          )}
          Mark all read
        </button>
      </header>

      {listQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No notifications yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            When your cycles mature, payments arrive, or an admin reviews a request, you'll see it
            here.
          </p>
        </div>
      ) : (
        <ul className="glass divide-y divide-border/40 overflow-hidden rounded-3xl">
          {items.map((n) => {
            const meta = notificationMeta(n.kind);
            const Icon = meta.icon;
            const unreadRow = !n.read_at;
            return (
              <li key={n.id}>
                <button
                  onClick={() => onOpen(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-card/60 ${
                    unreadRow ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      {unreadRow && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-muted-foreground">
                    {relativeTime(n.created_at)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
