import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Brand surfaces enumerated in the design (Requirement 1).
const SURFACES = [
  "src/routes/index.tsx",
  "src/routes/auth.tsx",
  "src/routes/_authenticated/dashboard.tsx",
  "src/routes/__root.tsx",
  "src/components/Ticker.tsx",
];

const root = process.cwd();

describe("brand lexical guard", () => {
  // Feature: phase-3-deposits-withdrawals, Property 15: No user-facing brand token reads "VFarm" unless it is "VFarmers"
  it('Property 15: case-sensitive "VFarm" appears only as "VFarmers" (filename imports excluded)', () => {
    const offending = /VFarm(?!ers)/; // case-sensitive; lowercase vfarm-logo.png never matches
    for (const rel of SURFACES) {
      const src = readFileSync(join(root, rel), "utf-8");
      const userFacing = src
        .split("\n")
        .filter((line) => !line.includes("vfarm-logo.png")) // exclude asset filename import
        .join("\n");
      expect(offending.test(userFacing), `${rel} contains a non-compliant VFarm token`).toBe(false);
    }
  });

  it("logo alt text equals VFarmers where present", () => {
    const index = readFileSync(join(root, "src/routes/index.tsx"), "utf-8");
    expect(index).toMatch(/alt="VFarmers logo"/);
    const auth = readFileSync(join(root, "src/routes/auth.tsx"), "utf-8");
    expect(auth).toMatch(/alt="VFarmers"/);
    const dashboard = readFileSync(join(root, "src/routes/_authenticated/dashboard.tsx"), "utf-8");
    expect(dashboard).toMatch(/alt="VFarmers"/);
  });
});
