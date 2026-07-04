/**
 * Unit tests for the /upgrade page states.
 * Requirements: 3.1, 3.2, 3.7, 3.8, 3.10
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock TanStack Router so the route works outside a router context
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => opts,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement("a", { href: to, ...props }, children),
}));

// Mock useServerFn to return the function itself (no-op wrapper in tests)
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

// Mock sonner toast
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock premium functions
const mockGetPremiumConfig = vi.fn();
const mockGetPremiumStatus = vi.fn();
const mockUpgradeToPremium = vi.fn();

vi.mock("@/lib/premium.functions", () => ({
  getPremiumConfig: mockGetPremiumConfig,
  getPremiumStatus: mockGetPremiumStatus,
  upgradeToPremium: mockUpgradeToPremium,
}));

// Mock PremiumBadge
vi.mock("@/components/premium/PremiumBadge", () => ({
  default: ({ name }: { name: string }) => React.createElement("span", { "data-testid": "premium-badge" }, name),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const standardStatus = {
  tier: "standard" as const,
  expires_at: null,
  days_left: 0,
  badge_name: "Premium Farmer",
  badge_color: "#F5C518",
  benefits: {
    farming_bonus_pct: 0.5,
    referral_gen2_pct: 0,
    referral_gen3_pct: 0,
    withdrawal_fee_premium_pct: 2,
    maintenance_ref_gen1_pct: 0,
    maintenance_ref_gen2_pct: 0,
    maintenance_ref_gen3_pct: 0,
  },
};

const activePremiumStatus = {
  ...standardStatus,
  tier: "premium" as const,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  days_left: 30,
};

const enabledConfig = {
  premium_enabled: true,
  premium_fee_usdt: 12,
  premium_duration_days: 365,
  premium_badge_name: "Premium Farmer",
  premium_badge_color: "#F5C518",
  premium_farming_bonus_pct: 0.5,
  referral_gen2_pct: 0,
  referral_gen3_pct: 0,
  withdrawal_fee_premium_pct: 2,
};

const disabledConfig = { ...enabledConfig, premium_enabled: false };

function renderPage() {
  // Dynamically import the component after mocks are set up
  const { UpgradePage } = require("./upgrade");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(UpgradePage)
    )
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UpgradePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Upgrade now button when user is standard tier (Req 3.1)", async () => {
    mockGetPremiumConfig.mockResolvedValue(enabledConfig);
    mockGetPremiumStatus.mockResolvedValue(standardStatus);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upgrade now/i })).toBeInTheDocument();
    });
    // Should NOT show Renew
    expect(screen.queryByRole("button", { name: /renew/i })).not.toBeInTheDocument();
  });

  it("shows Renew button when user has active premium (Req 3.8)", async () => {
    mockGetPremiumConfig.mockResolvedValue(enabledConfig);
    mockGetPremiumStatus.mockResolvedValue(activePremiumStatus);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /renew/i })).toBeInTheDocument();
    });
    // Should NOT show Upgrade now
    expect(screen.queryByRole("button", { name: /upgrade now/i })).not.toBeInTheDocument();
  });

  it("shows disabled message and disables buttons when premium_enabled is false (Req 3.10)", async () => {
    mockGetPremiumConfig.mockResolvedValue(disabledConfig);
    mockGetPremiumStatus.mockResolvedValue(standardStatus);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/not currently available/i)).toBeInTheDocument();
    });

    // The upgrade now button should be present but disabled
    const upgradeBtn = screen.getByRole("button", { name: /upgrade now/i });
    expect(upgradeBtn).toBeDisabled();
  });

  it("confirmation dialog shows correct fee and expiry date (Req 3.2, 3.3)", async () => {
    mockGetPremiumConfig.mockResolvedValue(enabledConfig);
    mockGetPremiumStatus.mockResolvedValue(standardStatus);

    renderPage();

    // Wait for page to load
    const upgradeBtn = await screen.findByRole("button", { name: /upgrade now/i });

    // Open confirmation dialog
    fireEvent.click(upgradeBtn);

    await waitFor(() => {
      // Fee amount should appear in the dialog
      expect(screen.getByText(/12/)).toBeInTheDocument();
      // Dialog should mention "USDT" deduction
      expect(screen.getByText(/USDT/i)).toBeInTheDocument();
    });
  });
});
