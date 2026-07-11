import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Coins, TrendingUp, ExternalLink, Lock } from "lucide-react";
import { useState } from "react";
import { getMyAffiliateSummary, getMyDownlines } from "@/lib/affiliate.functions";
import { getPremiumStatus, getPremiumConfig } from "@/lib/premium.functions";
import UpgradeCTA from "@/components/premium/UpgradeCTA";
import { PremiumNagModal } from "@/components/premium/PremiumNagModal";
import { ShareLink } from "@/components/affiliate/ShareLink";
import { ReferralFlyer } from "@/components/affiliate/ReferralFlyer";
import { Skeleton } from "@/components/ui/skeleton";
import { Loadable } from "@/components/ui/loadable";
import { SimpleRowsSkeleton } from "@/components/skeletons/ListSkeleton";

export const Route = createFileRoute("/_authenticated/affiliate/")({
  head: () => ({ meta: [{ title: "Affiliate · VFarmers" }] }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const sumFn = useServerFn(getMyAffiliateSummary);
  const dlFn = useServerFn(getMyDownlines);
  const premiumStatusFn = useServerFn(getPremiumStatus);
  const premiumConfigFn = useServerFn(getPremiumConfig);

  const summary = useQuery({ queryKey: ["aff-sum"], queryFn: () => sumFn() });
  const downlines = useQuery({ queryKey: ["aff-dl"], queryFn: () => dlFn() });
  const premiumStatus = useQuery({ queryKey: ["premium-status"], queryFn: () => premiumStatusFn() });
  const premiumConfig = useQuery({ queryKey: ["premium-config"], queryFn: () => premiumConfigFn() });

  const [genTab, setGenTab] = useState<1 | 2 | 3>(1);

  const isActivePremium =
    !!premiumStatus.data &&
    premiumStatus.data.tier !== "standard" &&
    premiumStatus.data.days_left > 0;

  const feeUsdt = premiumConfig.data?.premium_fee_usdt ?? 12;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Affiliate</h1>
        <p className="text-sm text-muted-foreground">Earn from 3 generations of farmers you bring to VFarmers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Coins} label="Total earned" loading={summary.isLoading} value={summary.data ? summary.data.totalEarned.toFixed(2) + " Seed" : "—"} />
        <Stat icon={TrendingUp} label="This month" loading={summary.isLoading} value={summary.data ? summary.data.monthEarned.toFixed(2) + " Seed" : "—"} />
        <Stat icon={Users} label="Direct (Gen 1)" loading={summary.isLoading} value={summary.data ? String(summary.data.gen1Count) : "—"} />
        {isActivePremium ? (
          <Stat
            icon={Users}
            label="Network (Gen 2 + 3)"
            loading={summary.isLoading}
            value={summary.data ? String(summary.data.gen2Count + summary.data.gen3Count) : "—"}
          />
        ) : (
          <LockedStat label="Network (Gen 2 + 3)" />
        )}
      </div>

      {summary.data?.referralCode && <ShareLink code={summary.data.referralCode} />}

      {summary.data?.referralCode && (
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <h3 className="mb-1 text-sm font-semibold">Referral flyer</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Your personalized flyer with your referral code baked in. Download it or share directly to WhatsApp, Telegram, or anywhere else.
          </p>
          <ReferralFlyer code={summary.data.referralCode} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your downlines</h3>
          <div className="flex items-center gap-2">
            <Link
              to="/affiliate/downlines"
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View details
            </Link>
            <div className="flex gap-1 rounded-lg border border-border bg-background/60 p-0.5 text-xs">
              {([1, 2, 3] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenTab(g)}
                  disabled={!isActivePremium && g !== 1}
                  title={!isActivePremium && g !== 1 ? "Upgrade to Premium to unlock Gen 2 & 3" : undefined}
                  className={`rounded-md px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                    genTab === g ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {!isActivePremium && g !== 1 ? <Lock className="inline h-3 w-3 mr-0.5" /> : null}Gen {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Locked state for Gen 2/3 when not premium — Requirements 6.8–6.9 */}
        {!isActivePremium && genTab !== 1 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              Generation {genTab} commissions are only available to Premium members.
            </p>
            <UpgradeCTA premiumFeeUsdt={feeUsdt} className="max-w-md" />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <Loadable loading={downlines.isLoading} skeleton={<SimpleRowsSkeleton rows={3} />}>
              {downlines.data?.filter((d) => d.generation === genTab).length === 0 ? (
                <p className="text-xs text-muted-foreground">No farmers in this generation yet.</p>
              ) : (
                downlines.data
                  ?.filter((d) => d.generation === genTab)
                  .map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                      <span>{d.display_name || d.username || "Farmer"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  ))
              )}
            </Loadable>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold">Recent commissions</h3>
        <div className="mt-3 space-y-1.5">
          {summary.data?.recent.length === 0 && (
            <p className="text-xs text-muted-foreground">No commissions yet.</p>
          )}
          {summary.data?.recent.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
              <span>
                Gen {c.generation} · {c.source}
              </span>
              <span className="font-medium text-primary">+{c.amount.toFixed(4)} Seed</span>
            </div>
          ))}
        </div>
      </div>

      {/* Premium nag modal — affiliate-specific message */}
      <PremiumNagModal
        storageKey="nag-affiliate"
        isStandard={!isActivePremium}
        headline="You're leaving money on the table."
        subheadline="Standard Farmers only earn from their direct (Gen 1) referrals. Premium unlocks a whole new income stream from your network."
        benefits={[
          { emoji: "🔗", title: "Gen 2 & Gen 3 commissions", body: "Every time a referral's referral reaps a cycle, you earn too — automatically." },
          { emoji: "🔧", title: "Maintenance fee rewards", body: "Earn a percentage of every maintenance fee your downline (Gens 1–3) pays." },
          { emoji: "📈", title: "Your network works for you", body: "The bigger your downline, the more premium multiplies your passive income." },
        ]}
        ctaLabel="Unlock All Generations"
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <div className="animate-fade-in mt-1 text-xl font-semibold">{value}</div>
      )}
    </div>
  );
}

/** Locked stat tile shown for Gen 2/3 when the user is not active premium. */
function LockedStat({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 opacity-60">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xl font-semibold text-muted-foreground">
        —
        <span className="text-[10px] uppercase tracking-wide font-medium">Premium only</span>
      </div>
    </div>
  );
}
