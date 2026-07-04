import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createHmac } from "node:crypto";

import { validatePayload, verifySignature } from "./test-credit";

const SECRET = "test-secret-key";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifySignature", () => {
  // Feature: phase-3-deposits-withdrawals, Property 13: The privileged credit occurs iff the request signature is valid
  it("Property 13: accepts iff header is a valid HMAC of the body under the secret", () => {
    fc.assert(
      fc.property(fc.string(), fc.boolean(), (body, corrupt) => {
        const good = sign(body);
        const header = corrupt ? good.slice(0, -1) + (good.endsWith("a") ? "b" : "a") : good;
        expect(verifySignature(body, header, SECRET)).toBe(!corrupt);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects missing header and wrong secret", () => {
    const body = '{"x":1}';
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, sign(body, "other"), SECRET)).toBe(false);
  });
});

describe("validatePayload", () => {
  // Feature: phase-3-deposits-withdrawals, Property 14: Test-credit amount/field validation rejects bad input without side effects
  it("Property 14: rejects non-positive/non-numeric amount and missing user_id, naming the field", () => {
    const payloadArb = fc.record({
      user_id: fc.oneof(fc.uuid(), fc.constant(""), fc.constant(undefined)),
      amount: fc.oneof(
        fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
        fc.constant("nan" as unknown as number),
        fc.constant(undefined),
      ),
    });
    fc.assert(
      fc.property(payloadArb, (p) => {
        const res = validatePayload(p);
        const validUser = typeof p.user_id === "string" && p.user_id.trim() !== "";
        const validAmount = typeof p.amount === "number" && Number.isFinite(p.amount) && p.amount > 0;
        expect(res.ok).toBe(validUser && validAmount);
        if (!res.ok) {
          expect(["user_id", "amount"]).toContain(res.field);
          if (!validUser) expect(res.field).toBe("user_id");
        }
      }),
      { numRuns: 100 },
    );
  });
});
