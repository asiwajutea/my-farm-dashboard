import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Crown,
  TrendingUp,
  Users,
  Percent,
  CalendarDays,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Coins,
  Sparkles,
  Check,
  X,
} from "lucide-react";

import {
  getPremiumConfig,
  getPremiumStatus,
  upgradeToPremium,
  type PremiumConfig,
  type PremiumStatus,
} from "@/lib/premium.functions";
import PremiumBadge from "@/components/premium/PremiumBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Membership · VFarmers" }] }),
  component: UpgradePage,
});

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function computeNewExpiry(status: PremiumStatus, durationDays: number): string {
  const base =
    status.tier === "premium" && status.expires_at
      ? new Date(status.expires_at)
      : new Date();
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

// ── Comparison row data ────────────────────────────────────────────────────

interface ComparisonRow {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  standard: string | false;   // false = not included
  premium: string | true;     // true = included (checkmark only)
}

function buildRows(config: PremiumConfig): ComparisonRow[] {
  return [
    {
      label: "Farming returns",
      icon: TrendingUp,
      standard: "Base rate only",
      premium: `Base rate +${config.premium_farming_bonus_pct}% bonus`,
    },
    {
      label: "Referral commissions",
      icon: Users,
      standard: "Generation 1 only",
      premium: `Gen 1 · Gen 2 (${config.referral_gen2_pct}%) · Gen 3 (${config.referral_gen3_pct}%)`,
    },
    {
      label: "Maintenance ref rewards",
      icon: Coins,
      standard: false,
      premium: "Generations 1, 2 & 3",
    },
    {
      label: "Withdrawal fee",
      icon: Percent,
      standard: "Standard rate",
      premium: `Reduced to ${config.withdrawal_fee_premium_pct}%`,
    },
    {
      label: "Premium Badge",
      icon: Sparkles,
      standard: false,
      premium: true,
    },
  ];
}

// ── Confirmation dialog ────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feeUsdt: number;
  newExpiry: string;
  isRenewal: boolean;
  submitting: boolean;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  feeUsdt,
  newExpiry,
  isRenewal,
  submitting,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isRenewal ? "Renew Premium Membership" : "Upgrade to Premium"}
          </DialogTitle>
          <DialogDescription>
            Please review the details before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount deducted</span>
            <span className="font-semibold">{feeUsdt} USDT</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Deducted from</span>
            <span className="font-medium">Primary Wallet</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {isRenewal ? "Extended to" : "Active until"}
            </span>
            <span className="font-medium">{fmtDate(newExpiry)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            {isRenewal ? "Renew" : "Confirm upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

function UpgradePage() {
  const configFn = useServerFn(getPremiumConfig);
  const statusFn = useServerFn(getPremiumStatus);
  const upgradeFn = useServerFn(upgradeToPremium);
  const qc = useQueryClient();

  const configQ = useQuery({ queryKey: ["premium-config"], queryFn: () => configFn() });
  const statusQ = useQuery({ queryKey: ["premium-status"], queryFn: () => statusFn() });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const config = configQ.data;
  const status = statusQ.data;
  const isLoading = configQ.isLoading || statusQ.isLoading;
  const isError = configQ.isError || statusQ.isError;

  const isActivePremium = !!(status && status.tier !== "standard" && status.days_left > 0);
  const premiumEnabled = config?.premium_enabled ?? true;
  const newExpiry = config && status ? computeNewExpiry(status, config.premium_duration_days) : "";

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await upgradeFn();
      if ("error" in result) { toast.error(result.error); return; }
      qc.setQueryData(["premium-status"], result);
      qc.invalidateQueries({ queryKey: ["premium-config"] });
      toast.success(isActivePremium
        ? "Premium renewed! Your membership has been extended."
        : "Welcome to Premium! Your membership is now active.");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upgrade failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-96 animate-pulse rounded-3xl bg-muted" />
          <div className="h-96 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !config || !status) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Failed to load membership data. Please refresh and try again.</span>
        </div>
      </div>
    );
  }

  const rows = buildRows(config);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Membership</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare plans and manage your membership.
        </p>
      </header>

      {/* premium_enabled = false banner */}
      {!premiumEnabled && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Premium upgrades are not currently available.
        </div>
      )}

      {/* Two-column plan cards */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* ── Standard column ─────────────────────────────────────────── */}
        <div className={`relative flex flex-col rounded-3xl border bg-card/40 p-6 ${
          !isActivePremium ? "border-primary/40 ring-2 ring-primary/20" : "border-border"
        }`}>
          {/* Current plan badge */}
          {!isActivePremium && (
            <div className="absolute -top-3 left-6">
              <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Current plan
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Standard Farmer</div>
              <div className="text-xs text-muted-foreground">Free forever</div>
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold">0</span>
            <span className="text-sm text-muted-foreground">USDT / year</span>
          </div>

          <ul className="mt-6 flex-1 space-y-3">
            {rows.map((row) => (
              <li key={row.label} className="flex items-start gap-2.5 text-sm">
                {row.standard !== false ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <div>
                  <span className={row.standard === false ? "text-muted-foreground/50 line-through" : ""}>
                    {row.label}
                  </span>
                  {row.standard && row.standard !== true && (
                    <div className="text-xs text-muted-foreground">{row.standard}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {!isActivePremium ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Active plan
              </div>
            ) : (
              <div className="rounded-xl border border-border py-2.5 text-center text-sm text-muted-foreground">
                Standard
              </div>
            )}
          </div>
        </div>

        {/* ── Premium column ───────────────────────────────────────────── */}
        <div className={`relative flex flex-col overflow-hidden rounded-3xl border bg-card/40 p-6 ${
          isActivePremium ? "border-primary/40 ring-2 ring-primary/20" : "border-border"
        }`}>
          {/* Decorative top gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-accent/60" />

          {/* Current plan badge */}
          {isActivePremium && (
            <div className="absolute -top-3 left-6">
              <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Current plan
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Premium Farmer</span>
                {isActivePremium && (
                  <PremiumBadge name={status.badge_name} color={status.badge_color} />
                )}
              </div>
              <div className="text-xs text-muted-foreground">Annual membership</div>
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-primary">{config.premium_fee_usdt}</span>
            <span className="text-sm text-muted-foreground">USDT / year</span>
          </div>

          {/* Active expiry info */}
          {isActivePremium && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              Expires {fmtDate(status.expires_at)} · {status.days_left} {status.days_left === 1 ? "day" : "days"} left
            </div>
          )}

          <ul className="mt-6 flex-1 space-y-3">
            {rows.map((row) => (
              <li key={row.label} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <span className="font-medium">{row.label}</span>
                  {row.premium !== true && (
                    <div className="text-xs text-muted-foreground">{row.premium}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {isActivePremium ? (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!premiumEnabled}
                variant="outline"
                className="w-full gap-2"
              >
                <Crown className="h-4 w-4" />
                Renew
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!premiumEnabled}
                className="w-full gap-2"
              >
                <Crown className="h-4 w-4" />
                Upgrade now — {config.premium_fee_usdt} USDT
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Duration note */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Premium membership lasts {config.premium_duration_days} days. Deducted from your Primary Wallet.
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        feeUsdt={config.premium_fee_usdt}
        newExpiry={newExpiry}
        isRenewal={isActivePremium}
        submitting={submitting}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
