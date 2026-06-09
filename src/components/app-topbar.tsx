import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, LogOut, User as UserIcon, ShieldCheck, CheckCheck, Loader2 } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
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
  const qc = useQueryClient();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Live unread badge + recent list, kept fresh by the realtime subscription.
  useNotificationsRealtime();
  const unreadQ = useUnreadCount();
  const listQ = useNotificationList(8);
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
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const openNotification = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate(n.id);
    setBellOpen(false);
    const meta = notificationMeta(n.kind);
    navigate({ to: meta.to ?? "/notifications" });
  };

  const recent = listQ.data ?? [];

  const name = profile?.display_name || email.split("@")[0] || "Farmer";
  const verified = profile?.kyc_status === "verified";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
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
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-elegant">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <span className="text-sm font-semibold">Notifications</span>
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
              </div>
              <div className="max-h-80 overflow-y-auto">
                {listQ.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : recent.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    You're all caught up.
                  </p>
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
                            className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-card ${
                              unreadRow ? "bg-primary/[0.04]" : ""
                            }`}
                          >
                            <div
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-medium">{n.title}</span>
                                {unreadRow && (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                )}
                              </div>
                              {n.body && (
                                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                                  {n.body}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                              {relativeTime(n.created_at)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setBellOpen(false)}
                className="block border-t border-border/40 px-3 py-2.5 text-center text-xs font-medium text-primary transition-colors hover:bg-card"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
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
