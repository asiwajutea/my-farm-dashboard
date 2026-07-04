import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const PAGE_SIZE = 20;

function NotificationsPage() {
  useNotificationsRealtime();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Fetch all — pagination is done client-side so we can combine with
  // real-time updates without extra server round trips. 200 is a safe cap.
  const listQ = useNotificationList(200);

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

  const [page, setPage] = useState(1);
  // Lazy-load: keep showing more rows as user scrolls, independent of
  // pagination so it works nicely on mobile too.
  const [lazyCount, setLazyCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const items = listQ.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  // Reset page and lazy count if new data arrives
  const prevLengthRef = useRef(items.length);
  useEffect(() => {
    if (items.length !== prevLengthRef.current) {
      prevLengthRef.current = items.length;
      setPage(1);
      setLazyCount(PAGE_SIZE);
    }
  }, [items.length]);

  // Current page slice
  const pageItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
  );

  // Lazy-load via IntersectionObserver — expands visible rows on scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && lazyCount < pageItems.length) {
          setLazyCount((c) => Math.min(c + PAGE_SIZE, pageItems.length));
        }
      },
      { rootMargin: "100px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazyCount, pageItems.length]);

  // Reset lazy count when page changes
  useEffect(() => { setLazyCount(PAGE_SIZE); }, [page]);

  const visibleItems = pageItems.slice(0, lazyCount);

  const onOpen = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate(n.id);
    const meta = notificationMeta(n.kind);
    if (meta.to) navigate({ to: meta.to });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cycle reaps, transfers, deposits, escrow updates and commissions — in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {unread} unread
            </span>
          )}
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
        </div>
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
        <>
          <ul className="glass divide-y divide-border/40 overflow-hidden rounded-3xl">
            {visibleItems.map((n) => {
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

          {/* Lazy-load sentinel */}
          <div ref={sentinelRef} />

          {/* Loading more indicator */}
          {lazyCount < pageItems.length && (
            <div className="mt-3 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors ${
                    page === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <span className="ml-1 text-xs text-muted-foreground">
                Page {page} of {totalPages} · {items.length} total
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
