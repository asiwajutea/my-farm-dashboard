import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, TrendingUp, Users, DollarSign, BarChart3, ShieldOff, UserPlus } from "lucide-react";

import {
  adminGetPremiumSettings,
  adminUpdatePremiumSettings,
  adminGetPremiumMetrics,
  adminGrantPremium,
  adminRevokePremium,
  type PremiumAdminSettings,
  type SettingsValidationError,
} from "@/lib/premium.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/premium")({
  head: () => ({ meta: [{ title: "Premium · Admin" }] }),
  component: AdminPremiumPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtUsdt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// ─── Page ────────────────────────────────────────────────────────────────────

function AdminPremiumPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Crown className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Premium Membership</h1>
          <p className="text-sm text-muted-foreground">
            Configure settings, view metrics, manage member access.
          </p>
        </div>
      </div>

      <MetricsSection />
      <SettingsSection />
      <TopReferrersSection />
      <GrantPremiumSection />
    </div>
  );
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

function MetricsSection() {
  const getFn = useServerFn(adminGetPremiumMetrics);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-premium-metrics"],
    queryFn: () => getFn(),
  });

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold">Metrics</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  const metrics = data ?? {
    premium_count: 0,
    standard_count: 0,
    conversion_rate: 0,
    total_revenue_usdt: 0,
    top_referrers: [],
  };

  const cards = [
    {
      label: "Total Premium Members",
      value: metrics.premium_count.toLocaleString(),
      icon: Crown,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Total Standard Members",
      value: metrics.standard_count.toLocaleString(),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Conversion Rate",
      value: `${(metrics.conversion_rate * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Revenue (USDT)",
      value: fmtUsdt(metrics.total_revenue_usdt),
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Metrics</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card/40 p-4 flex items-start gap-3"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Settings Form ────────────────────────────────────────────────────────────

type SettingsForm = PremiumAdminSettings;

function SettingsSection() {
  const getFn = useServerFn(adminGetPremiumSettings);
  const saveFn = useServerFn(adminUpdatePremiumSettings);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-premium-settings"],
    queryFn: () => getFn(),
    staleTime: 0,
  });

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SettingsValidationError[]>([]);

  const initialised = useRef(false);
  useEffect(() => {
    if (data && !initialised.current) {
      setForm(data);
      initialised.current = true;
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (f: SettingsForm) => saveFn({ data: f }),
    onSuccess: async (result) => {
      if ("errors" in result) {
        setFieldErrors(result.errors);
        toast.error("Please fix the highlighted fields");
        return;
      }
      setFieldErrors([]);
      toast.success("Premium settings saved");
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fieldError = (field: string): string | undefined =>
    fieldErrors.find((e) => e.field === field)?.message;

  if (isLoading || !form) {
    return (
      <section>
        <Skeleton className="mb-3 h-5 w-40" />
        <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => {
    setForm({ ...form, [k]: v });
    // Clear the field error when the user starts correcting
    setFieldErrors((prev) => prev.filter((e) => e.field !== k));
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Settings</h2>

      {/* General */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold">General</h3>
          <p className="text-xs text-muted-foreground">Core membership parameters.</p>

          <div className="mt-4 space-y-3">
            {/* premium_enabled */}
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">Premium upgrades enabled</span>
              <Toggle
                on={form.premium_enabled}
                onChange={(v) => set("premium_enabled", v)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField
                label="Fee (USDT)"
                step="0.01"
                value={form.premium_fee_usdt}
                onChange={(v) => set("premium_fee_usdt", v)}
                error={fieldError("premium_fee_usdt")}
              />
              <NumField
                label="Duration (days)"
                step="1"
                value={form.premium_duration_days}
                onChange={(v) => set("premium_duration_days", Math.max(1, Math.round(v)))}
                error={fieldError("premium_duration_days")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StrField
                label="Badge name"
                value={form.premium_badge_name}
                onChange={(v) => set("premium_badge_name", v)}
              />
              <div>
                <label className="text-xs text-muted-foreground">Badge color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.premium_badge_color}
                    onChange={(e) => set("premium_badge_color", e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-background/60 p-1"
                  />
                  <input
                    type="text"
                    value={form.premium_badge_color}
                    onChange={(e) => set("premium_badge_color", e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Farming & Referral */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold">Farming &amp; Referral</h3>
          <p className="text-xs text-muted-foreground">
            Bonus percentages applied on top of base rates for premium members.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PctField
              label="Farming bonus %"
              value={fmtPct(form.premium_farming_bonus_pct)}
              onChange={(v) => set("premium_farming_bonus_pct", Number(v) || 0)}
              error={fieldError("premium_farming_bonus_pct")}
            />
            <PctField
              label="Gen 2 referral %"
              value={fmtPct(form.referral_gen2_pct)}
              onChange={(v) => set("referral_gen2_pct", Number(v) || 0)}
              error={fieldError("referral_gen2_pct")}
            />
            <PctField
              label="Gen 3 referral %"
              value={fmtPct(form.referral_gen3_pct)}
              onChange={(v) => set("referral_gen3_pct", Number(v) || 0)}
              error={fieldError("referral_gen3_pct")}
            />
          </div>
        </div>

        {/* Withdrawal Fees */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold">Withdrawal Fees</h3>
          <p className="text-xs text-muted-foreground">Applied at withdrawal time based on member tier.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PctField
              label="Standard fee %"
              value={fmtPct(form.withdrawal_fee_standard_pct)}
              onChange={(v) => set("withdrawal_fee_standard_pct", Number(v) || 0)}
              error={fieldError("withdrawal_fee_standard_pct")}
            />
            <PctField
              label="Premium fee %"
              value={fmtPct(form.withdrawal_fee_premium_pct)}
              onChange={(v) => set("withdrawal_fee_premium_pct", Number(v) || 0)}
              error={fieldError("withdrawal_fee_premium_pct")}
            />
          </div>
        </div>

        {/* Maintenance Referral Rewards */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h3 className="text-sm font-semibold">Maintenance Ref Rewards</h3>
          <p className="text-xs text-muted-foreground">
            Share of maintenance fee credited to premium upline sponsors.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <PctField
              label="Gen 1 %"
              value={fmtPct(form.maintenance_ref_gen1_pct)}
              onChange={(v) => set("maintenance_ref_gen1_pct", Number(v) || 0)}
              error={fieldError("maintenance_ref_gen1_pct")}
            />
            <PctField
              label="Gen 2 %"
              value={fmtPct(form.maintenance_ref_gen2_pct)}
              onChange={(v) => set("maintenance_ref_gen2_pct", Number(v) || 0)}
              error={fieldError("maintenance_ref_gen2_pct")}
            />
            <PctField
              label="Gen 3 %"
              value={fmtPct(form.maintenance_ref_gen3_pct)}
              onChange={(v) => set("maintenance_ref_gen3_pct", Number(v) || 0)}
              error={fieldError("maintenance_ref_gen3_pct")}
            />
          </div>
        </div>

        <button
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
          className="rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save premium settings"}
        </button>
      </div>
    </section>
  );
}

// ─── Top Referrers Table ──────────────────────────────────────────────────────

function TopReferrersSection() {
  const getFn = useServerFn(adminGetPremiumMetrics);
  const revokeFn = useServerFn(adminRevokePremium);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-premium-metrics"],
    queryFn: () => getFn(),
    staleTime: 0,
  });

  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Premium revoked");
      setConfirmUserId(null);
      refetch();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmUserId(null);
    },
  });

  const referrers = data?.top_referrers ?? [];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Top Referrers</h2>
      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : referrers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No referrer data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3 text-right">Total Commissions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {referrers.map((r, i) => (
                <tr key={r.user_id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.username ? `@${r.username}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtUsdt(r.total_commissions)} USDT
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmUserId(r.user_id)}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <ShieldOff className="h-3 w-3" />
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmUserId && (
        <ConfirmDialog
          title="Revoke Premium"
          description="This will immediately set the member's tier to Standard and clear their expiry date. This cannot be undone from this dialog."
          confirmLabel="Revoke Premium"
          destructive
          loading={revoke.isPending}
          onConfirm={() => revoke.mutate(confirmUserId)}
          onCancel={() => setConfirmUserId(null)}
        />
      )}
    </section>
  );
}

// ─── Grant Premium Form ───────────────────────────────────────────────────────

function GrantPremiumSection() {
  const grantFn = useServerFn(adminGrantPremium);
  const [userId, setUserId] = useState("");
  const [days, setDays] = useState(365);
  const [errors, setErrors] = useState<{ userId?: string; days?: string }>({});

  const grant = useMutation({
    mutationFn: (args: { userId: string; days: number }) => grantFn({ data: args }),
    onSuccess: () => {
      toast.success("Premium granted");
      setUserId("");
      setDays(365);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!userId.trim()) newErrors.userId = "User ID is required";
    if (!days || days < 1) newErrors.days = "Days must be at least 1";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    grant.mutate({ userId: userId.trim(), days });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Grant Premium</h2>
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            Grant premium membership to a user without charging their wallet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">User ID (UUID)</label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setErrors((prev) => ({ ...prev, userId: undefined }));
                }}
                className={`mt-1 w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none font-mono ${
                  errors.userId
                    ? "border-destructive focus:border-destructive"
                    : "border-border focus:border-primary/60"
                }`}
              />
              {errors.userId && (
                <p className="mt-1 text-xs text-destructive">{errors.userId}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Days</label>
              <input
                type="number"
                min={1}
                step={1}
                value={days}
                onChange={(e) => {
                  setDays(Math.max(1, Math.round(Number(e.target.value) || 1)));
                  setErrors((prev) => ({ ...prev, days: undefined }));
                }}
                className={`mt-1 w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none ${
                  errors.days
                    ? "border-destructive focus:border-destructive"
                    : "border-border focus:border-primary/60"
                }`}
              />
              {errors.days && (
                <p className="mt-1 text-xs text-destructive">{errors.days}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={grant.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {grant.isPending ? "Granting…" : "Grant Premium"}
          </button>
        </form>
      </div>
    </section>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function NumField({
  label,
  value,
  onChange,
  step = "0.01",
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`mt-1 w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none ${
          error ? "border-destructive" : "border-border focus:border-primary/60"
        }`}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PctField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div
        className={`mt-1 flex items-center rounded-lg border bg-background/60 px-3 py-2 ${
          error ? "border-destructive" : "border-border focus-within:border-primary/60"
        }`}
      >
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StrField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
      />
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title" className="text-base font-semibold">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border bg-card/60 px-4 py-2 text-sm hover:bg-card disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-gradient-to-r from-primary to-accent text-primary-foreground"
            }`}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
