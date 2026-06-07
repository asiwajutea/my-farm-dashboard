import { describe, expect, it } from "vitest";

import { statusBadge } from "./StatusBadge";
import type { RequestStatus } from "@/lib/requests.shared";

describe("statusBadge", () => {
  // Feature: phase-3-deposits-withdrawals, Property 11: Status indicator matches request status
  it("Property 11: each status maps to a distinct indicator; no two share one", () => {
    const statuses: RequestStatus[] = ["pending", "approved", "rejected"];
    const descriptors = statuses.map((s) => statusBadge(s));
    const labels = new Set(descriptors.map((d) => d.label));
    const classes = new Set(descriptors.map((d) => d.className));
    expect(labels.size).toBe(statuses.length);
    expect(classes.size).toBe(statuses.length);
  });
});
