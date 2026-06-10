import { Lock, CalendarClock } from "lucide-react";
import type { PayoutLockState } from "@/lib/payout";

/** Render a YYYY-MM-DD date as e.g. "Fri, Jun 12, 2026" (date-only, no TZ drift). */
export function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Full-width notice shown in place of the withdrawal form while the portal is
 * locked (Thursday 00:00 → Friday 23:59 of a payout week).
 */
export function WithdrawalLockCard({ state }: { state: PayoutLockState }) {
  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Withdrawals are locked for payout</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        New withdrawal requests are paused from Thursday 12:00 AM through Friday 11:59 PM so every
        request can be vetted and processed before the payout on{" "}
        <span className="font-medium text-foreground">{fmtDate(state.payoutDate)}</span>.
      </p>
      <p className="mt-3 text-sm font-medium">The portal reopens on {fmtDate(state.reopenDate)}.</p>
    </div>
  );
}

/** Subtle one-line schedule hint shown while withdrawals are open. */
export function PayoutScheduleHint({ state }: { state: PayoutLockState }) {
  if (!state.enabled) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CalendarClock className="h-3.5 w-3.5" />
      Next payout {fmtDate(state.nextPayoutDate)}. Withdrawals lock from{" "}
      {fmtDate(state.lockStartDate)} (12:00 AM) to {fmtDate(state.lockEndDate)} (11:59 PM).
    </p>
  );
}
