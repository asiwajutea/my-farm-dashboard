import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Trophy, Lock, CheckCircle2, Sprout, Users, Wallet, Star, Crown, Flame, Sparkles, Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyCycles } from "@/lib/farm.functions";
import { getMyPvSummary } from "@/lib/pv.functions";
import { getMyAffiliateSummary } from "@/lib/affiliate.functions";
import { getPremiumStatus } from "@/lib/premium.functions";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements · VFarmers" },
      { name: "description", content: "Unlock badges as you grow your farm, build your team, and earn rewards." },
    ],
  }),
  component: AchievementsPage,
});

type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "farming" | "wealth" | "network" | "engagement";
  tier: Tier;
  target: number;
  progress: number;
  unit?: string;
  reward?: string;
};

const TIER_STYLES: Record<Tier, { ring: string; bg: string; text: string; glow: string; label: string }> = {
  bronze:   { ring: "ring-amber-700/40", bg: "bg-amber-700/10", text: "text-amber-500", glow: "shadow-[0_0_30px_-8px_rgba(180,83,9,0.4)]", label: "Bronze" },
  silver:   { ring: "ring-slate-300/40", bg: "bg-slate-300/10", text: "text-slate-200", glow: "shadow-[0_0_30px_-8px_rgba(203,213,225,0.4)]", label: "Silver" },
  gold:     { ring: "ring-yellow-400/50", bg: "bg-yellow-400/10", text: "text-yellow-300", glow: "shadow-[0_0_40px_-8px_rgba(250,204,21,0.55)]", label: "Gold" },
  platinum: { ring: "ring-cyan-300/50", bg: "bg-cyan-300/10", text: "text-cyan-200", glow: "shadow-[0_0_40px_-8px_rgba(103,232,249,0.55)]", label: "Platinum" },
  diamond:  { ring: "ring-fuchsia-400/50", bg: "bg-fuchsia-400/10", text: "text-fuchsia-200", glow: "shadow-[0_0_50px_-8px_rgba(232,121,249,0.6)]", label: "Diamond" },
};

const CATEGORY_META = {
  farming:    { label: "Farming",   icon: Sprout, color: "text-primary" },
  wealth:     { label: "Wealth",    icon: Wallet, color: "text-gold" },
  network:    { label: "Network",   icon: Users,  color: "text-cyan-400" },
  engagement: { label: "Engagement", icon: Sparkles, color: "text-fuchsia-400" },
} as const;

function AchievementsPage() {
  const fnCycles = useServerFn(listMyCycles);
  const fnPv = useServerFn(getMyPvSummary);
  const fnAff = useServerFn(getMyAffiliateSummary);
  const fnPremium = useServerFn(getPremiumStatus);

  const cyclesQ = useQuery({ queryKey: ["ach-cycles"], queryFn: () => fnCycles() });
  const pvQ = useQuery({ queryKey: ["my-pv"], queryFn: () => fnPv() });
  const affQ = useQuery({ queryKey: ["ach-affiliate"], queryFn: () => fnAff() });
  const premiumQ = useQuery({ queryKey: ["premium-status"], queryFn: () => fnPremium() });

  const [primaryUsdt, setPrimaryUsdt] = useState(0);
  const [displayName, setDisplayName] = useState("Farmer");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { data: ws }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("kind, balance").eq("user_id", user.id),
      ]);
      const primary = (ws ?? []).find((w) => w.kind === "primary");
      if (primary) setPrimaryUsdt(Number(primary.balance ?? 0));
      const raw = prof?.display_name || (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "Farmer";
      setDisplayName(raw.split(/\s+/)[0] || raw);
    })();
  }, []);

  const cycles = cyclesQ.data ?? [];
  const reapedCount = cycles.filter((c) => c.status === "reaped").length;
  const startedCount = cycles.length;
  const totalPv = pvQ.data?.total ?? 0;
  const gen1 = affQ.data?.gen1Count ?? 0;
  const totalReferrals = gen1 + (affQ.data?.gen2Count ?? 0) + (affQ.data?.gen3Count ?? 0);
  const totalEarned = affQ.data?.totalEarned ?? 0;
  const isPremium = (premiumQ.data?.tier ?? "standard") !== "standard" && (premiumQ.data?.days_left ?? 0) > 0;

  const achievements: Achievement[] = [
    // Farming
    { id: "first-seed",  title: "First Seed",       description: "Start your very first farming cycle.",       icon: Sprout, category: "farming", tier: "bronze",   target: 1,   progress: startedCount, reward: "+5 PV" },
    { id: "green-thumb", title: "Green Thumb",      description: "Reap 5 farming cycles successfully.",         icon: Sprout, category: "farming", tier: "silver",   target: 5,   progress: reapedCount, reward: "+25 PV" },
    { id: "harvester",   title: "Harvester",        description: "Reap 25 farming cycles.",                     icon: Sprout, category: "farming", tier: "gold",     target: 25,  progress: reapedCount, reward: "+100 PV" },
    { id: "farm-lord",   title: "Farm Lord",        description: "Reap 100 farming cycles.",                    icon: Trophy, category: "farming", tier: "platinum", target: 100, progress: reapedCount, reward: "Exclusive badge" },
    { id: "farm-titan",  title: "Farming Titan",    description: "Reap 500 farming cycles — legendary status.", icon: Trophy, category: "farming", tier: "diamond",  target: 500, progress: reapedCount, reward: "Titan badge + perks" },

    // Wealth
    { id: "first-hundred", title: "First Hundred",  description: "Hold 100 USDT in your primary wallet.",       icon: Wallet, category: "wealth", tier: "bronze",   target: 100,     progress: primaryUsdt, unit: "USDT" },
    { id: "high-roller",   title: "High Roller",    description: "Hold 1,000 USDT in your primary wallet.",     icon: Wallet, category: "wealth", tier: "silver",   target: 1000,    progress: primaryUsdt, unit: "USDT" },
    { id: "whale",         title: "Whale",          description: "Hold 10,000 USDT in your primary wallet.",    icon: Wallet, category: "wealth", tier: "gold",     target: 10000,   progress: primaryUsdt, unit: "USDT" },
    { id: "commissioner",  title: "Commissioner",   description: "Earn 500 USDT in referral commissions.",      icon: Star,   category: "wealth", tier: "platinum", target: 500,     progress: totalEarned, unit: "USDT" },

    // Network
    { id: "recruiter",     title: "Recruiter",      description: "Refer your first farmer.",                     icon: Users,  category: "network", tier: "bronze",   target: 1,   progress: gen1 },
    { id: "team-leader",   title: "Team Leader",    description: "Grow your Gen 1 downline to 10 farmers.",     icon: Users,  category: "network", tier: "silver",   target: 10,  progress: gen1 },
    { id: "empire-builder",title: "Empire Builder", description: "Build a network of 50+ across 3 generations.",icon: Crown,  category: "network", tier: "gold",     target: 50,  progress: totalReferrals },
    { id: "kingdom",       title: "Kingdom",        description: "250+ farmers in your downline network.",       icon: Crown,  category: "network", tier: "diamond",  target: 250, progress: totalReferrals },

    // Engagement
    { id: "pv-collector",  title: "PV Collector",   description: "Earn 100 Personal Volume points.",            icon: Star,     category: "engagement", tier: "bronze", target: 100,  progress: totalPv, unit: "PV" },
    { id: "pv-champion",   title: "PV Champion",    description: "Earn 1,000 Personal Volume points.",          icon: Flame,    category: "engagement", tier: "gold",   target: 1000, progress: totalPv, unit: "PV" },
    { id: "premium-member",title: "Premium Farmer", description: "Upgrade to a Premium membership tier.",       icon: Crown,    category: "engagement", tier: "platinum", target: 1,  progress: isPremium ? 1 : 0, reward: "Boosted earnings" },
  ];

  const unlocked = achievements.filter((a) => a.progress >= a.target).length;
  const totalPoints = achievements
    .filter((a) => a.progress >= a.target)
    .reduce((s, a) => s + tierPoints(a.tier), 0);
  const level = Math.max(1, Math.floor(totalPoints / 100) + 1);
  const nextLevelPoints = level * 100;
  const prevLevelPoints = (level - 1) * 100;
  const levelProgressPct = Math.min(100, Math.round(((totalPoints - prevLevelPoints) / (nextLevelPoints - prevLevelPoints)) * 100));

  const [filter, setFilter] = useState<"all" | keyof typeof CATEGORY_META>("all");
  const filtered = filter === "all" ? achievements : achievements.filter((a) => a.category === filter);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Hero / player card */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Achievements
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Keep growing, <span className="text-gradient-primary">{displayName}</span>
            </h1>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Every cycle, referral, and milestone you hit unlocks a badge. Chase the next one and level up your farmer profile.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full border border-border/60 bg-card/40 px-3 py-1">
                <span className="text-muted-foreground">Unlocked</span>{" "}
                <span className="font-semibold text-foreground">{unlocked}</span>
                <span className="text-muted-foreground"> / {achievements.length}</span>
              </span>
              <span className="rounded-full border border-border/60 bg-card/40 px-3 py-1">
                <span className="text-muted-foreground">Points</span>{" "}
                <span className="font-semibold text-foreground">{totalPoints}</span>
              </span>
            </div>
          </div>

          {/* Level ring */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                <circle cx="50" cy="50" r="44" strokeWidth="8" className="fill-none stroke-muted" />
                <circle
                  cx="50" cy="50" r="44" strokeWidth="8" strokeLinecap="round"
                  className="fill-none stroke-primary transition-all duration-700"
                  strokeDasharray={`${(levelProgressPct / 100) * 276.46} 276.46`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Level</span>
                <span className="text-2xl font-bold">{level}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{nextLevelPoints - totalPoints} pts</div>
              <div>to Level {level + 1}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} icon={Target} label={`All (${achievements.length})`} />
        {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((k) => {
          const meta = CATEGORY_META[k];
          const count = achievements.filter((a) => a.category === k).length;
          return <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} icon={meta.icon} label={`${meta.label} (${count})`} />;
        })}
      </div>

      {/* Grid */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <AchievementCard key={a.id} a={a} />
        ))}
      </div>

      {/* Nudge to keep going */}
      <div className="mt-8 glass rounded-3xl p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary" />
        <h3 className="mt-2 text-lg font-semibold">Ready for the next badge?</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Start a fresh farming cycle or invite a friend to accelerate your progress.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/farm" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
            <Sprout className="h-4 w-4" /> Start a cycle
          </Link>
          <Link to="/affiliate" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card">
            <Users className="h-4 w-4" /> Invite a friend
          </Link>
        </div>
      </div>
    </div>
  );
}

function tierPoints(t: Tier): number {
  return { bronze: 10, silver: 25, gold: 50, platinum: 100, diamond: 200 }[t];
}

function FilterChip({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const done = a.progress >= a.target;
  const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
  const style = TIER_STYLES[a.tier];
  const Icon = a.icon;
  const catMeta = CATEGORY_META[a.category];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className={`glass group relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5 ${done ? style.glow : ""}`}>
      {done && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
          <CheckCircle2 className="h-3 w-3" /> Unlocked
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-2 ${style.ring} ${style.bg} ${done ? style.text : "text-muted-foreground grayscale"}`}>
          <Icon className="h-6 w-6" />
          {!done && (
            <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1 ring-1 ring-border">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`truncate text-sm font-semibold ${done ? "" : "text-foreground/90"}`}>{a.title}</h3>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${style.bg} ${style.text}`}>
              {style.label}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <catMeta.icon className={`h-3 w-3 ${catMeta.color}`} />
            {catMeta.label}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {fmt(Math.min(a.progress, a.target))} / {fmt(a.target)} {a.unit ?? ""}
          </span>
          <span className={done ? style.text : ""}>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-700 ${done ? "bg-gradient-to-r from-primary to-accent" : "bg-primary/50"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {a.reward && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Reward: <span className="text-foreground/80">{a.reward}</span>
          </div>
        )}
      </div>
    </div>
  );
}