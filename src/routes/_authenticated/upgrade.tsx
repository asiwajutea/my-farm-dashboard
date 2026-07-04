import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Crown,
  TrendingUp,
  Users,
  ShieldCheck,
  Percent,
  CalendarDays,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Coins,
  Sparkles,
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
  head: () => ({ meta: [{ title: "Upgrade to Premium · VFarmers" }] }),
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

/** Compute the resulting expiry ISO string for display in the confirmation dialog.
 *  Active premium → extend from existing expires_at.
 *  Standard / expired → from now.
 */
function computeNewExpiry(status: PremiumStatus, durationDays: number): string {
  const base =
    status.tier === "premium" && status.expires_at
      ? new Date(status.expires_at)
      : new Date();
  const result = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return result.toISOString();
}

// ── Benefits list ──────────────────────────────────────────────────────────

interface BenefitItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function BenefitItem({ icon: Icon, title, description }: BenefitItemProps) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </li>
  );
}

function buildBenefits(config: PremiumConfig): BenefitItemProps[] {
  return [
    {
      icon: TrendingUp,
      title: "Enhanced farming returns",
      description: `+${config.premium_farming_bonus_pct}% bonus on top of your base farming reward every cycle.`,
    },
    {
      icon: Users,
      title: "3-generation referral commissions",
      description: `Earn from Gen 1, Gen 2 (${config.referral_gen2_pct}%), and Gen 3 (${config.referral_gen3_pct}%) downlines.`,
    },
    {
      icon: Coins,
      title: "Maintenance fee referral rewards",
      description: "Receive a share of maintenance fees paid by your downline Generations 1–3.",
    },
    {
      icon: Percent,
      title: "Lower withdrawal fee",
      description: `Pay only ${config.withdrawal_fee_premium_pct}% on withdrawals instead of the standard rate.`,
    },
    {
      icon: Sparkles,
      title: "Premium Badge",
      description: "Display your premium status with a visible badge on your profile and dashboard.",
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
            Please review the details below before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount deducted</span>
            <span className="font-semibold text-foreground">{feeUsdt} USDT</span>
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="gap-2">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crown className="h-4 w-4" />
            )}
            {isRenewal ? "Renew" : "Confirm upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page component ────────────────────────────────────────────────────

function UpgradePage() {
  const configFn = useServerFn(getPremiumConfig);
  const statusFn = useServerFn(getPremiumStatus);
  const upgradeFn = useServerFn(upgradeToPremium);
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ["premium-config"],
    queryFn: () => configFn(),
  });

  const statusQ = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => statusFn(),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const config = configQ.data;
  const status = statusQ.data;

  const isLoading = configQ.isLoading || statusQ.isLoading;
  const isError = configQ.isError || statusQ.isError;

  const isActivePremium = status?.tier === "premium";
  const premiumEnabled = config?.premium_enabled ?? true;

  const newExpiry =
    config && status ? computeNewExpiry(status, config.premium_duration_days) : "";

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await upgradeFn();

      // Discriminate PremiumStatus vs PremiumError
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // Success — update cache with fresh status (no page reload needed, Req 3.7)
      qc.setQueryData(["premium-status"], result);
      // Also invalidate config in case settings changed
      qc.invalidateQueries({ queryKey: ["premium-config"] });

      toast.success(
        isActivePremium
          ? "Premium renewed! Your membership has been extended."
          : "Welcome to Premium! Your membership is now active.",
      );
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upgrade failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <div className="h-48 animate-pulse rounded-3xl bg-muted" />
          <div className="h-32 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (isError || !config || !status) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Failed to load premium membership data. Please refresh and try again.</span>
        </div>
      </div>
    );
  }

  const benefits = buildBenefits(config);

  // ── State C — Active Premium ───────────────────────────────────────────
  if (isActivePremium) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Premium Membership</h1>
            <p className="text-sm text-muted-foreground">
              Your active membership status and renewal options.
            </p>
          </div>
        </header>

        {/* Active status card */}
        <div className="glass mt-6 rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <PremiumBadge
                  name={status.badge_name}
                  color={status.badge_color}
                />
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                Expires on{" "}
                <span className="font-medium text-foreground">
                  {fmtDate(status.expires_at)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {status.days_left} {status.days_left === 1 ? "day" : "days"} remaining
              </div>
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!premiumEnabled}
              variant="outline"
              className="gap-2"
            >
              <Crown className="h-4 w-4" />
              Renew
            </Button>
          </div>

          {/* premium_enabled = false notice */}
          {!premiumEnabled && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Premium upgrades are not currently available.
            </div>
          )}
        </div>

        {/* Benefits reminder */}
        <div className="glass mt-4 rounded-3xl p-6">
          <h2 className="mb-4 text-base font-semibold">Your benefits</h2>
          <ul className="space-y-4" aria-label="Premium benefits">
            {benefits.map((b) => (
              <BenefitItem key={b.title} {...b} />
            ))}
          </ul>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          feeUsdt={config.premium_fee_usdt}
          newExpiry={newExpiry}
          isRenewal={true}
          submitting={submitting}
          onConfirm={handleConfirm}
        />
      </div>
    );
  }

  // ── State A — Standard / expired  |  State B — premium_enabled = false ──
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Crown className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Upgrade to Premium</h1>
          <p className="text-sm text-muted-foreground">
            Unlock enhanced returns, 3-generation commissions, and more.
          </p>
        </div>
      </header>

      {/* premium_enabled = false — State B */}
      {!premiumEnabled && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Premium upgrades are not currently available.</span>
        </div>
      )}

      {/* Pricing card */}
      <div className="glass mt-5 overflow-hidden rounded-3xl">
        {/* Decorative top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-accent/60" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Annual membership
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">
                  {config.premium_fee_usdt}
                </span>
                <span className="text-lg text-muted-foreground">USDT</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {config.premium_duration_days} days of Premium access
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">Premium Farmer</span>
            </div>
          </div>

          {/* Benefits list */}
          <ul className="mt-6 space-y-4" aria-label="Premium benefits">
            {benefits.map((b) => (
              <BenefitItem key={b.title} {...b} />
            ))}
          </ul>

          {/* CTA button — State A */}
          <Button
            className="mt-6 w-full gap-2"
            onClick={() => setConfirmOpen(true)}
            disabled={!premiumEnabled}
            aria-disabled={!premiumEnabled}
          >
            <Crown className="h-4 w-4" />
            Upgrade now
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        feeUsdt={config.premium_fee_usdt}
        newExpiry={newExpiry}
        isRenewal={false}
        submitting={submitting}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
