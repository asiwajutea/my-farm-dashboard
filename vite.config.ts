// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
  vite: {
    build: {
      // Raise the warning threshold — recharts + radix are legitimately large
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Manual chunks: each group gets a content-hashed filename so the
          // browser caches it for a full year (immutable header in vercel.json).
          // When only app code changes, the vendor bundles stay cached.
          manualChunks(id) {
            // React core — changes almost never
            if (id.includes("node_modules/react") ||
                id.includes("node_modules/react-dom") ||
                id.includes("node_modules/scheduler")) {
              return "vendor-react";
            }
            // TanStack router + query — changes with package updates only
            if (id.includes("@tanstack/react-router") ||
                id.includes("@tanstack/react-query") ||
                id.includes("@tanstack/react-start") ||
                id.includes("@tanstack/router")) {
              return "vendor-tanstack";
            }
            // Radix UI primitives — large but rarely updated
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            // Recharts — large chart library, isolated so other chunks stay small
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-")) {
              return "vendor-charts";
            }
            // Supabase client
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            // All other node_modules go into a shared vendor chunk
            if (id.includes("node_modules")) {
              return "vendor-misc";
            }
          },
        },
      },
    },
  },
});
