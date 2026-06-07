import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  compareDesc,
  decodeCursor,
  encodeCursor,
  mergeAndSort,
  pageFrom,
} from "./requests.functions";
import type { RequestRow } from "@/lib/requests.shared";

function makeRow(id: string, createdAt: string, type: "deposit" | "withdrawal"): RequestRow {
  return {
    id,
    type,
    amount: "10.00",
    method: "bank_transfer",
    status: "pending",
    proof_url: null,
    created_at: createdAt,
  };
}

const rowArb = fc
  .tuple(
    fc.uuid(),
    fc.integer({ min: 0, max: 1_000_000 }), // seconds offset -> created_at
    fc.constantFrom<"deposit" | "withdrawal">("deposit", "withdrawal"),
  )
  .map(([id, secs, type]) =>
    makeRow(id, new Date(1_700_000_000_000 + secs * 1000).toISOString(), type),
  );

// Distinct ids so the (created_at, id) keyset is a total order.
const rowsArb = fc.uniqueArray(rowArb, {
  minLength: 0,
  maxLength: 120,
  selector: (r) => r.id,
});

describe("history merge/sort", () => {
  // Feature: phase-3-deposits-withdrawals, Property 9: History is the caller's deposits and withdrawals, projected and sorted newest-first
  it("Property 9: returns exactly the rows, sorted by created_at desc (id tiebreak)", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const sorted = mergeAndSort(rows);
        expect(sorted.length).toBe(rows.length);
        expect(new Set(sorted.map((r) => r.id))).toEqual(new Set(rows.map((r) => r.id)));
        for (let i = 1; i < sorted.length; i++) {
          expect(compareDesc(sorted[i - 1], sorted[i])).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("keyset pagination", () => {
  // Feature: phase-3-deposits-withdrawals, Property 10: Pagination returns at most 20 per page and traverses every request once
  it("Property 10: <= 20 per page; following nextCursor yields every row once, in order, no gaps/dupes", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const allSorted = mergeAndSort(rows);
        const limit = 20;
        const seen: RequestRow[] = [];
        let cursor = null as null | string;
        let guard = 0;
        do {
          const page = pageFrom(allSorted, cursor ? decodeCursor(cursor) : null, limit);
          expect(page.items.length).toBeLessThanOrEqual(limit);
          seen.push(...page.items);
          cursor = page.nextCursor;
          guard++;
          expect(guard).toBeLessThan(1000);
        } while (cursor);

        // Every row exactly once, in the same descending order as allSorted.
        expect(seen.map((r) => r.id)).toEqual(allSorted.map((r) => r.id));
        expect(new Set(seen.map((r) => r.id)).size).toBe(rows.length);
      }),
      { numRuns: 100 },
    );
  });

  it("cursor round-trips through encode/decode", () => {
    const c = { created_at: new Date().toISOString(), id: "abc-123" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("not-base64-$$")).toBeNull();
  });
});
