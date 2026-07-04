import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, LogOut, User as UserIcon, ShieldCheck, CheckCheck, Loader2, X, ArrowRight } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  useUnreadCount,
  useNotificationList,
  useNotificationsRealtime,
  NOTIFICATIONS_KEY,
} from "@/hooks/use-notifications";
import { markAllNotificationsRead, markNotificationRead, type NotificationRow } from "@/lib/notifications.functions";
import { notificationMeta, relativeTime } from "@/lib/notification-meta";

interface ProfileLite {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  kyc_status: string | null;
}

export function AppTopbar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  // Remember where the user was before opening notifications
  const returnPath = useRef<string>("/dashboard");
  const ref = useRef<HTMLDivElement>(null);

  // Live unread badge + recent list (capped at 10), kept fresh by realtime subscription.
  useNotificationsRealtime();
  const unreadQ = useUnreadCount();
  const listQ = useNotificationList(10);
  const unread = unreadQ.data ?? 0;

  const markReadFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const markRead = useMutation({
    mutationFn: (id: string) => markReadFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, username, kyc_status")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof ?? null);
      setAvatarUrl(await resolveAvatarUrl(prof?.avatar_url ?? null));
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleBellOpen = () => {
    // Capture current page before opening the sheet
    if (!bellOpen) {
      returnPath.current = pathname;
      // Mark all as read when panel opens
      if (unread > 0) markAll.mutate();
    }
    setBellOpen(true);
  };

  const handleBellClose = () => {
    setBellOpen(false);
    // Navigate back to where the user was (no-op if already there)
    navigate({ to: returnPath.current as "/" });
  };

  const openNotification = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate(n.id);
    setBellOpen(false);
    const meta = notificationMeta(n.kind);
    if (meta.to) navigate({ to: meta.to as "/" });
  };

  const recent = listQ.data ?? [];
  const name = profile?.display_name || email.split("@")[0] || "Farmer";
  const verified = profile?.kyc_status === "verified";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <div className="flex items-center gap-2">

        {/* Bell button — opens Sheet */}
        <button
          onClick={handleBellOpen}
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Notifications Sheet — slides from the right */}
        <Sheet open={bellOpen} onOpenChange={(v) => { if (!v) handleBellClose(); }}>
          <SheetContent side="right" className="w-full max-w-sm p-0 flex flex-col [&>button]:hidden">
            <SheetHeader className="flex flex-row items-center justify-between border-b border-border/40 px-4 py-3 space-y-0 shrink-0">
              <SheetTitle className="text-base">Notifications</SheetTitle>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending || unread === 0}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {markAll.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3" />
                  )}
                  Mark all read
                </button>
                <button
                  onClick={handleBellClose}
                  aria-label="Close notifications"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {listQ.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">You're all caught up</p>
                  <p className="mt-1 text-xs text-muted-foreground">No notifications yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {recent.map((n) => {
                    const meta = notificationMeta(n.kind);
                    const Icon = meta.icon;
                    const unreadRow = !n.read_at;
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => openNotification(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-card ${
                            unreadRow ? "bg-primary/[0.04]" : ""
                          }`}
                        >
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">{n.title}</span>
                              {unreadRow && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                              )}
                            </div>
                            {n.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                                {n.body}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border/40 p-3">
              <Link
                to="/notifications"
                onClick={() => setBellOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-medium text-primary hover:bg-card/80 transition-colors"
              >
                View all notifications
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </SheetContent>
        </Sheet>

        {/* Profile dropdown */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-2 py-1.5 transition-colors hover:bg-card"
          >
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="hidden text-sm sm:inline">{name}</span>
            {verified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-elegant">
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {profile?.username ? `@${profile.username}` : email}
              </div>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-card"
              >
                <UserIcon className="h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
