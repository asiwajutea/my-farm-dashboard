import {
  Bell,
  Sprout,
  Wheat,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Handshake,
  Coins,
  CalendarClock,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import type { NotificationKind } from "@/lib/notifications.functions";

type Meta = {
  icon: LucideIcon;
  /** Tailwind classes for the icon chip (text + bg). */
  tone: string;
  /** In-app route the notification points at, when applicable. */
  to?: string;
};

// Visual treatment + deep-link target per notification kind. Keeping this in
// one place means the page and the topbar dropdown render identically.
const META: Record<NotificationKind, Meta> = {
  cycle_matured: { icon: Sprout, tone: "text-primary bg-primary/15", to: "/farm" },
  cycle_reaped: { icon: Wheat, tone: "text-primary bg-primary/15", to: "/farm" },
  deposit_approved: { icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-400/15", to: "/wallet" },
  deposit_rejected: { icon: XCircle, tone: "text-destructive bg-destructive/15", to: "/wallet" },
  withdrawal_approved: { icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-400/15", to: "/wallet" },
  withdrawal_rejected: { icon: XCircle, tone: "text-destructive bg-destructive/15", to: "/wallet" },
  transfer_received: { icon: ArrowDownLeft, tone: "text-primary bg-primary/15", to: "/wallet" },
  escrow_created: { icon: Handshake, tone: "text-amber-400 bg-amber-400/15", to: "/escrow" },
  escrow_accepted: { icon: Handshake, tone: "text-primary bg-primary/15", to: "/escrow" },
  escrow_released: { icon: ArrowDownLeft, tone: "text-emerald-400 bg-emerald-400/15", to: "/escrow" },
  escrow_cancelled: { icon: XCircle, tone: "text-muted-foreground bg-muted", to: "/escrow" },
  escrow_disputed: { icon: ShieldAlert, tone: "text-amber-400 bg-amber-400/15", to: "/escrow" },
  escrow_refunded: { icon: ArrowDownLeft, tone: "text-primary bg-primary/15", to: "/escrow" },
  affiliate_commission: { icon: Coins, tone: "text-emerald-400 bg-emerald-400/15", to: "/affiliate" },
  maintenance_due: { icon: CalendarClock, tone: "text-amber-400 bg-amber-400/15", to: "/affiliate" },
  admin_balance_adjusted: { icon: Coins, tone: "text-primary bg-primary/15", to: "/wallet" },
  system: { icon: Bell, tone: "text-muted-foreground bg-muted" },
};

export function notificationMeta(kind: NotificationKind): Meta {
  return META[kind] ?? META.system;
}

// Compact relative time, e.g. "just now", "5m", "3h", "2d", else a date.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}
