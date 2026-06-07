import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  AMOUNT_MAX,
  DEPOSIT_AMOUNT_MIN,
  DEPOSIT_METHODS,
  METHOD_MAX_LEN,
  PROOF_MAX_BYTES,
  PROOF_MIME,
  WITHDRAWAL_AMOUNT_MIN,
  WITHDRAWAL_METHODS,
  isDepositMethod,
  isWithdrawalMethod,
  parseAmount,
  validateProof,
} from "./requests.shared";

// Reference oracle: is `raw` numeric, in [min, max], with <= 2 decimals?
function oracleAccepts(raw: string, min: number): boolean {
  if (!/^[+-]?\d+(\.\d+)?$/.test(raw)) return false;
  const frac = raw.replace(/^[+-]/, "").split(".")[1] ?? "";
  if (frac.length > 2) return false;
  const v = Number(raw);
  return Number.isFinite(v) && v >= min && v <= AMOUNT_MAX;
}

describe("parseAmount", () => {
  // Feature: phase-3-deposits-withdrawals, Property 1: Amount accepted iff numeric, in range, and at most two decimals
  it("Property 1: accepts iff numeric, in range, <= 2 decimals; normalized value round-trips", () => {
    const amountStrings = fc.oneof(
      fc.float({ noNaN: true }).map((n) => String(n)),
      fc.integer().map((n) => String(n)),
      fc.string(),
      fc
        .tuple(fc.integer({ min: 0, max: 1_000_000_000 }), fc.integer({ min: 0, max: 9999 }))
        .map(([a, b]) => `${a}.${b}`),
      fc.constantFrom("0", "0.00", "-1", "1e5", "999999999.99", "1000000000", "abc", ""),
    );
    fc.assert(
      fc.property(amountStrings, fc.constantFrom(DEPOSIT_AMOUNT_MIN, WITHDRAWAL_AMOUNT_MIN), (raw, min) => {
        const res = parseAmount(raw, min);
        expect(res.ok).toBe(oracleAccepts(raw.trim(), min));
        if (res.ok) {
          // normalized is a 2-dp string that equals the input numerically
          expect(res.value).toMatch(/^\d+\.\d{2}$/);
          expect(Number(res.value)).toBeCloseTo(Number(raw), 2);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("rejects 3+ decimals with too_many_decimals", () => {
    const res = parseAmount("1.234", DEPOSIT_AMOUNT_MIN);
    expect(res).toEqual({ ok: false, code: "too_many_decimals" });
  });
});

describe("method validation", () => {
  // Feature: phase-3-deposits-withdrawals, Property 2: Method accepted iff in the supported allow-list
  it("Property 2: deposit/withdrawal methods accepted iff in allow-list (withdrawal also len <= 30)", () => {
    const anyMethod = fc.oneof(
      fc.constantFrom(...DEPOSIT_METHODS, ...WITHDRAWAL_METHODS),
      fc.string(),
    );
    fc.assert(
      fc.property(anyMethod, (m) => {
        expect(isDepositMethod(m)).toBe((DEPOSIT_METHODS as readonly string[]).includes(m));
        expect(isWithdrawalMethod(m)).toBe(
          (WITHDRAWAL_METHODS as readonly string[]).includes(m) && m.length <= METHOD_MAX_LEN,
        );
      }),
      { numRuns: 100 },
    );
  });
});

describe("validateProof", () => {
  // Feature: phase-3-deposits-withdrawals, Property 3: Proof accepted iff allowed type and size
  it("Property 3: accepts iff mime in allow-list and 0 < size <= 10MB", () => {
    const mime = fc.oneof(fc.constantFrom(...PROOF_MIME), fc.string());
    const size = fc.integer({ min: -10, max: PROOF_MAX_BYTES + 5_000_000 });
    fc.assert(
      fc.property(mime, size, (m, s) => {
        const res = validateProof({ mimeType: m, byteSize: s });
        const expected = (PROOF_MIME as readonly string[]).includes(m) && s > 0 && s <= PROOF_MAX_BYTES;
        expect(res.ok).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
