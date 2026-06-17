import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Users,
  Coins,
  TrendingUp,
  Trophy,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Search,
  Globe,
  Star,
} from "lucide-react";
import { getDownlineReport, type DownlineDetailRow } from "@/lib/affiliate.functions";
import { seedToUsdt, fmtSeed, fmtUsdt } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SimpleRowsSkeleton } from "@/components/skeletons/ListSkeleton";

export const Route = createFileRoute("/_authenticated/affiliate/downlines")({
  head: () => ({ meta: [{ title: "Downline Report · VFarmers" }] }),
  component: DownlineReportPage,
});

const GEN_COLORS: Record<number, string> = {
  1: "bg-primary/15 text-primary border-primary/30",
  2: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  3: "bg-violet-500/15 text-violet-500 border-violet-500/30",
};

type SortKey = "joined_at" | "commissions_from_member" | "total_seeds_invested" | "generation";
type SortDir = "asc" | "desc";

function DownlineReportPage() {
  const reportFn = useServerFn(getDownlineReport);
  const report = useQuery({ queryKey: ["downline-report"], queryFn: () => reportFn() });

  const [genFilter, setGenFilter] = useState<0 | 1 | 2 | 3>(0);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("commissions_from_member");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rate = report.data?.seed_to_usdt ?? 1;

  const sorted = useMemo(() => {
    if (!report.data) return [];
    let rows = report.data.members;
    if (genFilter !== 0) rows = rows.filter((r) => r.generation === genFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.display_name ?? "").toLowerCase().includes(q) ||
          (r.username ?? "").toLowerCase().includes(q) ||
          (r.country ?? "").toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "joined_at") return mul * (a.joined_at < b.joined_at ? -1 : 1);
      return mul * (Number(a[sortKey]) - Number(b[sortKey]));
    });
    return rows;
  }, [report.data, genFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (report.isLoading) return <ReportSkeleton />;

  const { team } = report.data!;
  const topEarner = report.data!.members.find((m) => m.id === team.top_earner_id);

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-6 px-5 py-8">
      <Link
        to="/affiliate"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Affiliate
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Downline Report</h1>
        <p className="text-sm text-muted-foreground">
          Full network analytics across all 3 generations of your team.
        </p>
      </div>

      {/* ── Team Analytics ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Team Analytics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total members" value={String(team.total_members)} sub="across all generations" />
          <StatCard
            icon={Coins}
            label="Total earned"
            value={fmtSeed(team.total_commissions_seed)}
            sub={fmtUsdt(seedToUsdt(team.total_commissions_seed, rate))}
          />
          <StatCard
            icon={TrendingUp}
            label="This month"
            value={fmtSeed(team.this_month_seed)}
            sub={fmtUsdt(seedToUsdt(team.this_month_seed, rate))}
          />
          <StatCard
            icon={BarChart3}
            label="Avg per member"
            value={fmtSeed(team.avg_commission_per_member)}
            sub={fmtUsdt(seedToUsdt(team.avg_commission_per_member, rate))}
          />
        </div>
      </section>

      {/* ── Team Performance ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Team Performance
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {([1, 2, 3] as const).map((g) => {
            const count = g === 1 ? team.gen1_count : g === 2 ? team.gen2_count : team.gen3_count;
            const genMembers = report.data!.members.filter((m) => m.generation === g);
            const genTotal = genMembers.reduce((s, m) => s + m.commissions_from_member, 0);
            const pct = team.total_commissions_seed > 0
              ? Math.round((genTotal / team.total_commissions_seed) * 100)
              : 0;
            return (
              <div key={g} className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${GEN_COLORS[g]}`}>
                    Gen {g}
                  </span>
                  {team.most_active_gen === g && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
                      <Star className="h-3 w-3" /> Most active
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{count}</div>
                  <div className="text-xs text-muted-foreground">farmers</div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{fmtSeed(genTotal)}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {fmtUsdt(seedToUsdt(genTotal, rate))} · {pct}% of total earnings
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Top Performer Spotlight ── */}
      {topEarner && (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wider">Top Performer</p>
            <p className="mt-0.5 font-semibold truncate">
              {topEarner.display_name || topEarner.username || "Farmer"}
              {topEarner.username && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">@{topEarner.username}</span>
              )}
            </p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <div className="font-semibold tabular-nums text-amber-500">{fmtSeed(topEarner.commissions_from_member)}</div>
            <div className="text-xs text-muted-foreground">{fmtUsdt(seedToUsdt(topEarner.commissions_from_member, rate))}</div>
          </div>
        </div>
      )}

      {/* ── Individual Performance Table ── */}
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Individual Performance
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search farmers…"
                className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            {/* Gen filter */}
            <div className="flex rounded-lg border border-border bg-background/60 p-0.5 text-xs">
              {([0, 1, 2, 3] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenFilter(g)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    genFilter === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g === 0 ? "All" : `Gen ${g}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            {report.data!.members.length === 0
              ? "You have no downline farmers yet. Share your referral link to grow your team."
              : "No farmers match your filter."}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_120px_140px_140px_36px] gap-3 border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Farmer</span>
              <SortHeader label="Gen" k="generation" cur={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Joined" k="joined_at" cur={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Seeds invested" k="total_seeds_invested" cur={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Your earnings" k="commissions_from_member" cur={sortKey} dir={sortDir} onSort={toggleSort} />
              <span />
            </div>

            <div className="divide-y divide-border/40">
              {sorted.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  rate={rate}
                  isExpanded={expanded === m.id}
                  onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                  isTop={m.id === team.top_earner_id && !!team.top_earner_id}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function MemberRow({
  member: m,
  rate,
  isExpanded,
  onToggle,
  isTop,
}: {
  member: DownlineDetailRow;
  rate: number;
  isExpanded: boolean;
  onToggle: () => void;
  isTop: boolean;
}) {
  const name = m.display_name || m.username || "Farmer";
  const initials = name.charAt(0).toUpperCase();
  const usdtEarned = seedToUsdt(m.commissions_from_member, rate);
  const usdtInvested = seedToUsdt(m.total_seeds_invested, rate);

  return (
    <div>
      {/* Main row */}
      <div
        className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_120px_140px_140px_36px] gap-3 items-center px-4 py-3 hover:bg-card/60 transition-colors cursor-pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
      >
        {/* Identity */}
        <div className="flex items-center gap-3 min-w-0">
          {m.avatar_url ? (
            <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-sm font-medium truncate">{name}</span>
              {isTop && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {m.username && <span>@{m.username}</span>}
              {m.country && (
                <>
                  {m.username && <span>·</span>}
                  <Globe className="h-3 w-3" />
                  <span>{m.country}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Gen badge (hidden on mobile, shown in expanded) */}
        <div className="hidden sm:flex">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${GEN_COLORS[m.generation]}`}>
            Gen {m.generation}
          </span>
        </div>

        {/* Joined */}
        <div className="hidden sm:block text-xs text-muted-foreground">
          {new Date(m.joined_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        </div>

        {/* Seeds invested — hidden on mobile */}
        <div className="hidden sm:block">
          <div className="text-sm font-medium tabular-nums">{fmtSeed(m.total_seeds_invested)}</div>
          <div className="text-xs text-muted-foreground">{fmtUsdt(usdtInvested)}</div>
        </div>

        {/* Your earnings */}
        <div className="sm:hidden text-right">
          <div className="text-sm font-semibold tabular-nums text-primary">
            {fmtSeed(m.commissions_from_member)}
          </div>
          <div className="text-xs text-muted-foreground">{fmtUsdt(usdtEarned)}</div>
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-semibold tabular-nums text-primary">
            {fmtSeed(m.commissions_from_member)}
          </div>
          <div className="text-xs text-muted-foreground">{fmtUsdt(usdtEarned)}</div>
        </div>

        {/* Expand toggle */}
        <button className="text-muted-foreground hover:text-foreground" aria-label="Toggle details">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="border-t border-border/40 bg-background/40 px-4 py-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <Detail label="Generation">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${GEN_COLORS[m.generation]}`}>
              Gen {m.generation}
            </span>
          </Detail>
          <Detail label="Joined">{new Date(m.joined_at).toLocaleDateString()}</Detail>
          <Detail label="Country">{m.country ?? "—"}</Detail>
          <Detail label="Commission events">{String(m.commission_count)}</Detail>
          <Detail label="Seeds invested">
            <span>{fmtSeed(m.total_seeds_invested)}</span>
            <span className="block text-xs text-muted-foreground">{fmtUsdt(usdtInvested)}</span>
          </Detail>
          <Detail label="Your total earnings">
            <span className="text-primary font-semibold">{fmtSeed(m.commissions_from_member)}</span>
            <span className="block text-xs text-muted-foreground">{fmtUsdt(usdtEarned)}</span>
          </Detail>
          <Detail label="Last commission">
            {m.last_commission_at
              ? new Date(m.last_commission_at).toLocaleDateString()
              : "—"}
          </Detail>
          <Detail label="Avg per event">
            {m.commission_count > 0
              ? fmtSeed(m.commissions_from_member / m.commission_count)
              : "—"}
          </Detail>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

function SortHeader({
  label,
  k,
  cur,
  dir,
  onSort,
}: {
  label: string;
  k: SortKey;
  cur: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = cur === k;
  return (
    <button
      onClick={() => onSort(k)}
      className={`flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
    >
      {label}
      {active ? (
        dir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-8 animate-pulse">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-52" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
      <SimpleRowsSkeleton rows={5} />
    </div>
  );
}
