import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// ── Stale time constants (ms) ─────────────────────────────────────────────
// Data is grouped by how often it genuinely changes so the browser avoids
// unnecessary network round-trips while still showing fresh content.

/** Near-static: platform config, achievement rewards, PV activities.
 *  Refreshes at most once every 10 minutes per tab. */
const STALE_STATIC = 10 * 60 * 1_000;

/** Slow-moving: premium status, profile, affiliate summary, PV totals.
 *  1 minute is enough — these don't change per-second. */
const STALE_SLOW = 60 * 1_000;

/** Fast-moving: cycles, wallet balances, notifications.
 *  30 seconds — real-money data should stay relatively fresh. */
const STALE_FAST = 30 * 1_000;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Default: treat data as fresh for 30 s so navigating back to a page
        // doesn't re-fetch if the user was just there.
        staleTime: STALE_FAST,
        // Keep unused query data in the cache for 5 minutes before GC.
        gcTime: 5 * 60 * 1_000,
        // Don't hammer the server on transient errors — one retry is enough.
        retry: 1,
        retryDelay: 1_000,
        // Don't refetch just because the browser tab was backgrounded and
        // re-focused for content that updates via realtime subscriptions anyway.
        refetchOnWindowFocus: false,
        // Allow background refetch when the tab comes back online.
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  // ── Per-query staleTime overrides ─────────────────────────────────────
  // Queries whose keys start with these prefixes get longer stale windows.
  // This is applied via queryClient.setQueryDefaults so any useQuery call
  // that matches inherits the right TTL without touching individual files.

  // Platform / admin configuration — changes only when admin saves
  queryClient.setQueryDefaults(["platform-settings"],           { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["pv-activities"],               { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["admin-achievement-rewards"],   { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["ach-rewards"],                 { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["premium-config"],              { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["seed-rate"],                   { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["site-state"],                  { staleTime: STALE_STATIC });
  queryClient.setQueryDefaults(["payout-methods"],              { staleTime: STALE_STATIC });

  // User profile / membership — changes only on explicit user actions
  queryClient.setQueryDefaults(["premium-status"],              { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["has-passcode"],                { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["recovery-phrase-status"],      { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["my-pv"],                       { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["ach-aff"],                     { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["ach-prem-dl"],                 { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["ach-streaks"],                 { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["ach-p2p"],                     { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["ach-escrow"],                  { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["ach-coupons"],                 { staleTime: STALE_SLOW });
  queryClient.setQueryDefaults(["rate-history"],                { staleTime: STALE_SLOW });

  // Live financial data — keep 30 s default but enable background refetch
  queryClient.setQueryDefaults(["dashboard-cycles"],            { staleTime: STALE_FAST, refetchInterval: 30_000 });
  queryClient.setQueryDefaults(["notifications", "unread-count"], { staleTime: STALE_FAST, refetchOnWindowFocus: true });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preloaded data is considered fresh for 30 s — prevents a second fetch
    // immediately after a link hover preload.
    defaultPreloadStaleTime: STALE_FAST,
    // Preload linked routes on hover/focus so navigation feels instant.
    defaultPreload: "intent",
  });

  return router;
};
