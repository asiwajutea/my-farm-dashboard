import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAYOUT_CONFIG,
  PAYOUT_PERIOD_DAYS,
  getPayoutLockState,
  isWithdrawalLocked,
  type PayoutConfig,
} from "./payout";

// Anchor 2026-06-12 is a Friday. Tests use UTC so Date construction is exact;
// a dedicated block covers the time-zone boundary behaviour.
const utc: PayoutConfig = { anchor: "2026-06-12", lockEnabled: true, timeZone: "UTC" };

const at = (iso: string) => new Date(iso);

describe("getPayoutLockState — lock window (Thu 00:00 → Fri 23:59)", () => {
  it("locks the payout Friday all day", () => {
    expect(isWithdrawalLocked(at("2026-06-12T00:00:00Z"), utc)).toBe(true);
    expect(isWithdrawalLocked(at("2026-06-12T12:00:00Z"), utc)).toBe(true);
    expect(isWithdrawalLocked(at("2026-06-12T23:59:59Z"), utc)).toBe(true);
  });

  it("locks the Thursday immediately before payout all day", () => {
    expect(isWithdrawalLocked(at("2026-06-11T00:00:00Z"), utc)).toBe(true);
    expect(isWithdrawalLocked(at("2026-06-11T23:59:59Z"), utc)).toBe(true);
  });

  it("is unlocked on Wednesday (two days before payout)", () => {
    expect(isWithdrawalLocked(at("2026-06-10T12:00:00Z"), utc)).toBe(false);
  });

  it("reopens on Saturday (day after payout)", () => {
    expect(isWithdrawalLocked(at("2026-06-13T00:00:00Z"), utc)).toBe(false);
  });
});

describe("getPayoutLockState — every OTHER Friday", () => {
  it("does not lock the off-week Friday or its Thursday", () => {
    // 7 days after the anchor payout — the in-between (skipped) Friday.
    expect(isWithdrawalLocked(at("2026-06-19T12:00:00Z"), utc)).toBe(false);
    expect(isWithdrawalLocked(at("2026-06-18T12:00:00Z"), utc)).toBe(false);
  });

  it("locks the next bi-weekly payout Friday and its Thursday", () => {
    // 14 days after the anchor.
    expect(isWithdrawalLocked(at("2026-06-26T12:00:00Z"), utc)).toBe(true);
    expect(isWithdrawalLocked(at("2026-06-25T12:00:00Z"), utc)).toBe(true);
  });

  it("locks a payout Friday before the anchor (negative phase)", () => {
    // 14 days before the anchor — still on the cadence.
    expect(isWithdrawalLocked(at("2026-05-29T12:00:00Z"), utc)).toBe(true);
    expect(isWithdrawalLocked(at("2026-05-28T12:00:00Z"), utc)).toBe(true);
    // The skipped Friday in between is open.
    expect(isWithdrawalLocked(at("2026-06-05T12:00:00Z"), utc)).toBe(false);
  });
});

describe("getPayoutLockState — derived dates", () => {
  it("reports the upcoming payout and reopen dates while open", () => {
    const s = getPayoutLockState(at("2026-06-10T12:00:00Z"), utc); // Wednesday
    expect(s.locked).toBe(false);
    expect(s.nextPayoutDate).toBe("2026-06-12");
    expect(s.lockStartDate).toBe("2026-06-11");
    expect(s.lockEndDate).toBe("2026-06-12");
    expect(s.reopenDate).toBe("2026-06-13");
  });

  it("on the Thursday lock day, points at the next-day payout", () => {
    const s = getPayoutLockState(at("2026-06-11T08:00:00Z"), utc);
    expect(s.locked).toBe(true);
    expect(s.payoutDate).toBe("2026-06-12");
    expect(s.reopenDate).toBe("2026-06-13");
  });

  it("after a payout, the next payout is two weeks out", () => {
    const s = getPayoutLockState(at("2026-06-15T12:00:00Z"), utc); // Monday
    expect(s.locked).toBe(false);
    expect(s.nextPayoutDate).toBe("2026-06-26");
  });
});

describe("getPayoutLockState — enable switch and time zone", () => {
  it("never locks when disabled", () => {
    const off = { ...utc, lockEnabled: false };
    expect(isWithdrawalLocked(at("2026-06-12T12:00:00Z"), off)).toBe(false);
    expect(getPayoutLockState(at("2026-06-12T12:00:00Z"), off).enabled).toBe(false);
  });

  it("evaluates the calendar day in the configured time zone", () => {
    const lagos: PayoutConfig = { ...utc, timeZone: "Africa/Lagos" }; // UTC+1
    // 23:30Z Wed is 00:30 Thu in Lagos -> locked.
    expect(isWithdrawalLocked(at("2026-06-10T23:30:00Z"), lagos)).toBe(true);
    // 23:30Z Fri is 00:30 Sat in Lagos -> open.
    expect(isWithdrawalLocked(at("2026-06-12T23:30:00Z"), lagos)).toBe(false);
  });
});

describe("default config", () => {
  it("uses a 14-day cadence and a valid anchor", () => {
    expect(PAYOUT_PERIOD_DAYS).toBe(14);
    expect(DEFAULT_PAYOUT_CONFIG.anchor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DEFAULT_PAYOUT_CONFIG.lockEnabled).toBe(true);
  });
});
