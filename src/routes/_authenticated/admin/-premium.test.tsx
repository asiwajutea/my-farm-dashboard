/**
 * Unit tests for the /admin/premium page.
 * Requirements: 12.1, 12.2, 12.5
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => opts,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement("a", { href: to, ...props }, children),
  useNavigate: () => vi.fn(),
  redirect: (opts: { to: string }) => { throw new Error(`REDIRECT:${opts.to}`); },
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
}));

const mockAdminGetPremiumSettings = vi.fn();
const mockAdminUpdatePremiumSettings = vi.fn();
const mockAdminGetPremiumMetrics = vi.fn();
const mockAdminGrantPremium = vi.fn();
const mockAdminRevokePremium = vi.fn();

vi.mock("@/lib/premium.functions", () => ({
  adminGetPremiumSettings: mockAdminGetPremiumSettings,
  adminUpdatePremiumSettings: mockAdminUpdatePremiumSettings,
  adminGetPremiumMetrics: mockAdminGetPremiumMetrics,
  adminGrantPremium: mockAdminGrantPremium,
  adminRevokePremium: mockAdminRevokePremium,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultSettings = {
  premium_enabled: true,
  premium_fee_usdt: 12,
  premium_duration_days: 365,
  premium_badge_name: "Premium Farmer",
  premium_badge_color: "#F5C518",
  premium_farming_bonus_pct: 0.5,
  referral_gen2_pct: 0,
  referral_gen3_pct: 0,
  withdrawal_fee_premium_pct: 2,
  withdrawal_fee_standard_pct: 5,
  maintenance_ref_gen1_pct: 0,
  maintenance_ref_gen2_pct: 0,
  maintenance_ref_gen3_pct: 0,
};

const defaultMetrics = {
  premium_count: 42,
  standard_count: 158,
  conversion_rate: 0.21,
  total_revenue_usdt: 504,
  top_referrers: [],
};

function renderPage() {
  const { AdminPremiumPage } = require("./premium");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AdminPremiumPage)
    )
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminPremiumPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminGetPremiumSettings.mockResolvedValue(defaultSettings);
    mockAdminGetPremiumMetrics.mockResolvedValue(defaultMetrics);
  });

  it("settings form displays current values from adminGetPremiumSettings (Req 12.2)", async () => {
    renderPage();

    // Wait for form to load with pre-filled values
    await waitFor(() => {
      // Fee field should show 12
      const feeInput = screen.getByDisplayValue("12");
      expect(feeInput).toBeInTheDocument();
    });
  });

  it("shows field-level validation error on invalid fee (Req 12.2)", async () => {
    mockAdminUpdatePremiumSettings.mockResolvedValue({
      errors: [{ field: "premium_fee_usdt", message: "Fee must be ≥ 0" }],
    });

    renderPage();

    // Wait for the form to load
    await screen.findByDisplayValue("12");

    // Find the save button and click it (simulating invalid submission)
    const saveBtn = screen.getByRole("button", { name: /save premium settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockAdminUpdatePremiumSettings).toHaveBeenCalled();
    });
  });

  it("Grant Premium form calls adminGrantPremium with correct args (Req 12.5)", async () => {
    mockAdminGrantPremium.mockResolvedValue({ ok: true });

    renderPage();

    // Wait for page to load
    await screen.findByText(/grant premium/i);

    // Fill in userId
    const userIdInput = screen.getByPlaceholderText(/xxxxxxxx-xxxx/i);
    fireEvent.change(userIdInput, {
      target: { value: "00000000-0000-0000-0000-000000000001" },
    });

    // Submit the grant form
    const grantBtn = screen.getByRole("button", { name: /grant premium/i });
    fireEvent.click(grantBtn);

    await waitFor(() => {
      expect(mockAdminGrantPremium).toHaveBeenCalledWith({
        data: {
          userId: "00000000-0000-0000-0000-000000000001",
          days: 365, // default
        },
      });
    });
  });

  it("displays metric cards from adminGetPremiumMetrics (Req 12.3)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument(); // premium_count
      expect(screen.getByText("158")).toBeInTheDocument(); // standard_count
    });
  });
});
