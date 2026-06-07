import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Two test environments:
//  - node    (default): pure-logic + server-function unit/property tests
//  - jsdom            : component tests (files named *.dom.test.ts(x))
// `vite-tsconfig-paths` wires the `@/` alias so imports resolve in tests.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    environmentMatchGlobs: [["**/*.dom.test.{ts,tsx}", "jsdom"]],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
