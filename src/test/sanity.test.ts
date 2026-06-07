import { describe, expect, it } from "vitest";

// Trivial test confirming the runner executes (Task 1 acceptance).
describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
