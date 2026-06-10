// Bi-weekly payout schedule + withdrawal lock-window logic.
//
// Payouts happen every other Friday (a 14-day cadence anchored on a known
// payout Friday). To make sure every request is vetted and processed before a
// payout, the withdrawal portal is locked from Thursday 00:00 through Friday
// 23:59 of the payout week — i.e. the day before the payout and the payout day
// itself.
//
// Pure module (no I/O, no React) — safe to import from both client and server
// code. The lock decision is made purely on the *calendar date* in the
// configured time zone, so the Thursday-00:00 / Saturday-00:00 boundaries are
// exact regardless of the caller's local clock.

/** Payout cadence in days (every other Friday). */
export const PAYOUT_PERIOD_DAYS = 14;

/**
 * Default anchor payout date — must be a Friday. 2026-06-12 is a Friday.
 * Bi-weekly payouts recur every {@link PAYOUT_PERIOD_DAYS} days from this date
 * in both directions.
 */
export const DEFAULT_PAYOUT_ANCHOR = "2026-06-12";

/** Default IANA time zone the schedule is evaluated in (WAT, no DST). */
export const DEFAULT_PAYOUT_TIMEZONE = "Africa/Lagos";

export interface PayoutConfig {
  /** YYYY-MM-DD of a known payout Friday. */
  anchor: string;
  /** Master switch for the lock window. */
  lockEnabled: boolean;
  /** IANA time zone the Thursday/Friday boundaries are evaluated in. */
  timeZone: string;
}

export interface PayoutLockState {
  /** Whether the lock feature is enabled at all. */
  enabled: boolean;
  /** Whether withdrawals are currently locked. */
  locked: boolean;
  /** YYYY-MM-DD of the payout this lock window leads into (or today, on a payout day). */
  payoutDate: string;
  /** YYYY-MM-DD of the next upcoming payout relative to `now`. */
  nextPayoutDate: string;
  /** YYYY-MM-DD the portal reopens (the day after the payout). */
  reopenDate: string;
  /** YYYY-MM-DD the active/next lock window opens (Thursday). */
  lockStartDate: string;
  /** YYYY-MM-DD the active/next lock window closes (Friday / payout day). */
  lockEndDate: string;
}

export const DEFAULT_PAYOUT_CONFIG: PayoutConfig = {
  anchor: DEFAULT_PAYOUT_ANCHOR,
  lockEnabled: true,
  timeZone: DEFAULT_PAYOUT_TIMEZONE,
};

const MS_PER_DAY = 86_400_000;

/** Calendar (Y, M, D) of `date` as observed in `timeZone`. */
function zonedDateParts(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Whole days since the Unix epoch for a calendar date (date-only, UTC-based). */
function dayNumberFromYMD(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Parse a `YYYY-MM-DD` string to its epoch day number. */
function ymdToDayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return dayNumberFromYMD(y, m, d);
}

/** Render an epoch day number back to a `YYYY-MM-DD` string. */
function dayNumberToYMD(n: number): string {
  const date = new Date(n * MS_PER_DAY);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Non-negative remainder (JS `%` keeps the sign of the dividend). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Compute the withdrawal lock state for `now` given a payout schedule.
 *
 * Withdrawals are locked on the payout day (Friday) and the day immediately
 * before it (Thursday). The decision is calendar-date based in the configured
 * time zone, so the lock opens at Thursday 00:00 and clears at Saturday 00:00.
 */
export function getPayoutLockState(now: Date, config: PayoutConfig): PayoutLockState {
  const timeZone = config.timeZone || DEFAULT_PAYOUT_TIMEZONE;
  const anchor = config.anchor || DEFAULT_PAYOUT_ANCHOR;

  const { y, m, d } = zonedDateParts(now, timeZone);
  const todayNum = dayNumberFromYMD(y, m, d);
  const anchorNum = ymdToDayNumber(anchor);
  const diff = todayNum - anchorNum;
  const phase = mod(diff, PAYOUT_PERIOD_DAYS);

  const isPayoutDay = phase === 0;
  const isDayBeforePayout = phase === PAYOUT_PERIOD_DAYS - 1;
  const lockedByCalendar = isPayoutDay || isDayBeforePayout;

  // The payout date tied to the current window:
  // - on a payout day, it's today;
  // - on the day before, it's tomorrow;
  // - otherwise it's the next payout strictly ahead.
  let payoutNum: number;
  if (isPayoutDay) {
    payoutNum = todayNum;
  } else if (isDayBeforePayout) {
    payoutNum = todayNum + 1;
  } else {
    payoutNum = anchorNum + Math.ceil(diff / PAYOUT_PERIOD_DAYS) * PAYOUT_PERIOD_DAYS;
  }

  // Next upcoming payout relative to today (today counts as "upcoming").
  const nextPayoutNum =
    phase === 0 ? todayNum : anchorNum + Math.ceil(diff / PAYOUT_PERIOD_DAYS) * PAYOUT_PERIOD_DAYS;

  return {
    enabled: config.lockEnabled,
    locked: config.lockEnabled && lockedByCalendar,
    payoutDate: dayNumberToYMD(payoutNum),
    nextPayoutDate: dayNumberToYMD(nextPayoutNum),
    reopenDate: dayNumberToYMD(payoutNum + 1),
    lockStartDate: dayNumberToYMD(payoutNum - 1),
    lockEndDate: dayNumberToYMD(payoutNum),
  };
}

/** Convenience predicate: are withdrawals locked at `now`? */
export function isWithdrawalLocked(now: Date, config: PayoutConfig): boolean {
  return getPayoutLockState(now, config).locked;
}
