import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, Wallet, Coins, ArrowLeftRight, History as HistoryIcon, TrendingUp, Plus, Clock, Star, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MaintenanceCard } from "@/components/maintenance/MaintenanceCard";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyCycles, reapCycleFn, type Cycle } from "@/lib/farm.functions";
import { getMyPvSummary } from "@/lib/pv.functions";
import { getPremiumStatus } from "@/lib/premium.functions";
import { getRecoveryPhraseStatus } from "@/lib/recovery-phrase.functions";
import PremiumBadge from "@/components/premium/PremiumBadge";
import { PremiumNagModal } from "@/components/premium/PremiumNagModal";
import { RecoveryPhraseNagModal } from "@/components/recovery/RecoveryPhraseNagModal";
import { OnboardingFlow, hasSeenOnboarding } from "@/components/OnboardingFlow";
import { useSiteState } from "@/hooks/use-site-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtAmount, seedToUsdt } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · VFarmers" }] }),
  component: Dashboard,
});

type WalletKind = "primary" | "farming";
interface WalletRow {
  kind: WalletKind;
  balance: number;
  locked: number;
}

function Dashboard() {
  const [name, setName] = useState("Farmer");
  const [wallets, setWallets] = useState<Partial<Record<WalletKind, WalletRow>>>({});
  const [rate, setRate] = useState<number>(1);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: siteState } = useSiteState();

  const fnCycles = useServerFn(listMyCycles);
  const fnReap = useServerFn(reapCycleFn);
  const fnPv = useServerFn(getMyPvSummary);
  const fnPremiumStatus = useServerFn(getPremiumStatus);
  const fnRecoveryStatus = useServerFn(getRecoveryPhraseStatus);

  const cyclesQ = useQuery({
    queryKey: ["dashboard-cycles"],
    queryFn: () => fnCycles(),
    refetchInterval: 30_000,
  });
  const pvQ = useQuery({
    queryKey: ["my-pv"],
    queryFn: () => fnPv(),
  });
  const premiumStatusQ = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => fnPremiumStatus(),
  });
  const recoveryStatusQ = useQuery({
    queryKey: ["recovery-phrase-status"],
    queryFn: () => fnRecoveryStatus(),
    // Only fetch once on mount — no need to poll
    staleTime: Infinity,
  });
  const pvTotal = pvQ.data?.total ?? 0;
  const activeCycles = (cyclesQ.data ?? []).filter(
    (c) => c.status === "active" || c.status === "matured",
  );

  async function handleReap(id: string) {
    try {
      await fnReap({ data: { cycleId: id } });
      toast.success("Reaped! Rewards added to your Farming wallet 🎉");
      cyclesQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reap");
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { data: ws }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("display_name, referral_code").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("kind, balance, locked").eq("user_id", user.id),
        supabase.from("app_settings").select("seed_to_usdt").maybeSingle(),
      ]);
      // Prefer profile display_name, then first word of full_name metadata, then email prefix
      const raw =
        prof?.display_name ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Farmer";
      const fullName = raw.split(/\s+/)[0] || raw;
      setName(fullName);
      if (prof?.referral_code) setReferralCode(prof.referral_code);
      if (ws) {
        const map: Partial<Record<WalletKind, WalletRow>> = {};
        for (const w of ws as WalletRow[]) map[w.kind] = w;
        setWallets(map);
      }
      if (settings?.seed_to_usdt) setRate(Number(settings.seed_to_usdt));

      // Show onboarding after a short delay if not seen yet
      // Delay keeps it from clashing with other modals (recovery phrase, etc.)
      if (!hasSeenOnboarding()) {
        setTimeout(() => setShowOnboarding(true), 2000);
      }
    })();
  }, []);

  // Primary wallet is USDT-denominated; farming wallet is Seed-denominated
  const primaryUsdt = Number(wallets.primary?.balance ?? 0);
  const farmingSeed = Number(wallets.farming?.balance ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sprout className="h-3.5 w-3.5" />
              Farmer dashboard
            </div>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back, <span className="text-gradient-primary">{name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your wallets and farming cycles, all in one place.
          </p>
          {/* Compact membership row — no card, just a label + action link */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Membership:</span>
            {premiumStatusQ.data && premiumStatusQ.data.tier !== "standard" && premiumStatusQ.data.days_left > 0 ? (
              <PremiumBadge
                name={premiumStatusQ.data.badge_name}
                color={premiumStatusQ.data.badge_color}
              />
            ) : (
              <>
                <span className="text-xs font-medium">Standard</span>
                <span className="text-xs text-muted-foreground">·</span>
                <Link
                  to="/upgrade"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Crown className="h-3 w-3" />
                  Subscribe to Premium
                </Link>
              </>
            )}
          </div>
          {/* PV badge + Start a cycle — both left-aligned so they stack cleanly on mobile */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400">
              <Star className="h-3.5 w-3.5" />
              {pvQ.isLoading ? "…" : `${pvTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} PV`}
            </div>
            <Link
              to="/farm"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              Start a cycle
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Link to="/wallet" className="block">
          <WalletCard title="Primary Wallet" mode="usdt" usdt={primaryUsdt} seed={rate > 0 ? primaryUsdt / rate : 0} sub="Deposits and withdrawals" accent="gold" icon={Wallet} />
        </Link>
        <Link to="/wallet" className="block">
          <WalletCard title="Farming Wallet" mode="seed" usdt={farmingSeed * rate} seed={farmingSeed} sub="Active farming activity" accent="primary" icon={Sprout} />
        </Link>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction to="/deposit" label="Deposit" icon={Plus} />
        <QuickAction to="/send" label="P2P Transfer" icon={ArrowLeftRight} />
        <QuickAction to="/farm" label="Reap" icon={Coins} />
        <QuickAction to="/history" label="History" icon={HistoryIcon} />
      </section>

      <section className="mt-6">
        <MaintenanceCard />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active farming cycles</h2>
          <Link to="/farm" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {cyclesQ.isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        ) : activeCycles.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No active farming cycles</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Move Seeds to your Farming Wallet and start a cycle to begin harvesting rewards.
            </p>
            <Link
              to="/farm"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card"
            >
              <Sprout className="h-4 w-4 text-primary" />
              Go to Farm
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCycles.slice(0, 5).map((c) => (
              <ActiveCycleRow key={c.id} cycle={c} rate={rate} onReap={() => handleReap(c.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Premium nag modal — only for standard members */}
      <PremiumNagModal
        storageKey="nag-dashboard"
        isStandard={!premiumStatusQ.data || premiumStatusQ.data.tier === "standard" || premiumStatusQ.data.days_left <= 0}
        headline="Premium Farmers earn more — every single day."
        subheadline="Your current Standard plan limits what you earn. Here's what you're missing out on right now:"
        benefits={[
          { emoji: "🌱", title: "Boosted farming returns", body: "Premium members earn a bonus percentage on top of every cycle reward — automatically." },
          { emoji: "👥", title: "3-generation referral income", body: "You only earn from Gen 1 referrals. Premium unlocks Gen 2 and Gen 3 commissions too." },
          { emoji: "💸", title: "Maintenance fee rewards", body: "Earn a share of maintenance fees paid by your entire downline — Gens 1, 2 & 3." },
          { emoji: "🏷️", title: "Lower withdrawal fee", body: "Premium members pay a reduced fee on every withdrawal, keeping more USDT in your wallet." },
        ]}
        ctaLabel="See Premium Plans"
      />

      {/* Recovery phrase nag modal — shown once if not yet set up */}
      {recoveryStatusQ.data && !recoveryStatusQ.data.hasPhrase && (
        <RecoveryPhraseNagModal
          onDismiss={() => recoveryStatusQ.refetch()}
        />
      )}

      {/* Onboarding tour — shown once to new users, 2 s after mount */}
      {showOnboarding && (
        <OnboardingFlow
          name={name}
          referralCode={referralCode}
          telegramGroupUrl={siteState?.telegram_group_url ?? null}
          telegramChannelUrl={siteState?.telegram_channel_url ?? null}
          onDone={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

function ActiveCycleRow({
  cycle,
  rate,
  onReap,
}: {
  cycle: Cycle;
  rate: number;
  onReap: () => void;
}) {
  const amount = Number(cycle.amount);
  const reward = (amount * cycle.reward_bps) / 10000;
  const startMs = new Date(cycle.started_at).getTime();
  const maturesMs = new Date(cycle.matures_at).getTime();
  const now = Date.now();
  const total = Math.max(1, maturesMs - startMs);
  const elapsed = Math.max(0, Math.min(total, now - startMs));
  const pct = Math.round((elapsed / total) * 100);
  const matured = cycle.status === "matured" || now >= maturesMs;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sprout className="h-4 w-4 text-primary" />
            {fmtAmount(amount)} Seed
            <span className="text-xs font-normal text-muted-foreground">
              ≈ {fmtAmount(seedToUsdt(amount, rate))} USDT
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {matured ? "Matured" : `Matures ${new Date(cycle.matures_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
            <span>· Reward {fmtAmount(reward)} Seed</span>
          </div>
        </div>
        {matured ? (
          <Button size="sm" onClick={onReap}>Reap</Button>
        ) : (
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Active
          </span>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickAction({
  to, label, icon: Icon,
}: { to: "/deposit" | "/send" | "/farm" | "/history"; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link to={to} className="glass flex flex-col items-center gap-1.5 rounded-2xl py-4 text-xs transition-colors hover:border-primary/50 hover:text-primary">
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function WalletCard({
  title, mode, usdt, seed, sub, accent, icon: Icon,
}: {
  title: string;
  mode: "usdt" | "seed";
  usdt: number;
  seed: number;
  sub: string;
  accent: "primary" | "gold";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const main = mode === "usdt" ? fmt(usdt) : fmt(seed);
  const mainUnit = mode === "usdt" ? "USDT" : "Seed";
  const subUnit = mode === "usdt" ? "Seed" : "USDT";
  const subVal = mode === "usdt" ? fmt(seed) : fmt(usdt);
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-6">
      <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${accent === "gold" ? "bg-gold/15" : "bg-primary/15"}`} />
      <div className="relative flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent === "gold" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative mt-5">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{main}</span>
          <span className="text-sm text-muted-foreground">{mainUnit}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">≈ {subVal} {subUnit} · {sub}</div>
      </div>
    </div>
  );
}
