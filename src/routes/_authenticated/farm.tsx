import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
import { Sprout, Clock, TrendingUp, Wallet as WalletIcon, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransferToFarmingDialog } from "@/components/wallet/TransferToFarmingDialog";
import { TransferToPrimaryDialog } from "@/components/wallet/TransferToPrimaryDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSeedRate } from "@/components/wallet/RequestForm";
import { seedToUsdt, fmtAmount } from "@/lib/currency";
import {
  listBoosters,
  listMyCycles,
  startCycleFn,
  reapCycleFn,
  getFarmingBalance,
  type Booster,
  type Cycle,
} from "@/lib/farm.functions";
import { getPremiumStatus } from "@/lib/premium.functions";
import { PremiumNagModal } from "@/components/premium/PremiumNagModal";

export const Route = createFileRoute("/_authenticated/farm")({
  head: () => ({ meta: [{ title: "Farm · VFarmers" }] }),
  component: FarmPage,
});

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function bpsToPct(bps: number) {
  return (bps / 100).toFixed(2) + "%";
}

/** "1,234.00 Seed (≈ 12.34 USDT)" — users see Seed primary, USDT equivalent. */
function seedWithUsdt(seed: number, rate: number) {
  return `${fmt(seed)} Seed (≈ ${fmtAmount(seedToUsdt(seed, rate))} USDT)`;
}

function FarmPage() {
  const qc = useQueryClient();
  const fnBoosters = useServerFn(listBoosters);
  const fnCycles = useServerFn(listMyCycles);
  const fnBalance = useServerFn(getFarmingBalance);
  const fnStart = useServerFn(startCycleFn);
  const fnReap = useServerFn(reapCycleFn);

  const boostersQ = useQuery({ queryKey: ["boosters"], queryFn: () => fnBoosters() });
  const cyclesQ = useQuery({ queryKey: ["cycles"], queryFn: () => fnCycles(), refetchInterval: 30_000 });
  const balanceQ = useQuery({ queryKey: ["farming-balance"], queryFn: () => fnBalance() });
  const { data: rate = 1 } = useSeedRate();

  // Premium status — for nag modal
  const fnPremiumStatus = useServerFn(getPremiumStatus);
  const premiumStatusQ = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => fnPremiumStatus(),
    staleTime: 60_000,
  });
  const isStandard = !premiumStatusQ.data || premiumStatusQ.data.tier === "standard" || premiumStatusQ.data.days_left <= 0;

  const [boosterId, setBoosterId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startMut = useMutation({
    mutationFn: (vars: { boosterId: string; amount: number }) => fnStart({ data: vars }),
    onSuccess: () => {
      toast.success("Cycle started 🌱");
      setAmount("");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["cycles"] });
      qc.invalidateQueries({ queryKey: ["farming-balance"] });
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to start cycle");
      setConfirmOpen(false);
    },
  });

  const reapMut = useMutation({
    mutationFn: (cycleId: string) => fnReap({ data: { cycleId } }),
    onSuccess: () => {
      toast.success("Reaped! Rewards added to your Farming wallet 🎉");
      qc.invalidateQueries({ queryKey: ["cycles"] });
      qc.invalidateQueries({ queryKey: ["farming-balance"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to reap"),
  });

  const balance = balanceQ.data?.balance ?? 0;
  const primaryBalanceQ = useQuery({
    queryKey: ["primary-balance"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { balance: 0, locked: 0 };
      const { data } = await supabase
        .from("wallets")
        .select("balance, locked")
        .eq("user_id", user.id)
        .eq("kind", "primary")
        .maybeSingle();
      return { balance: Number(data?.balance ?? 0), locked: Number(data?.locked ?? 0) };
    },
  });
  const primaryAvailableUsdt =
    (primaryBalanceQ.data?.balance ?? 0) - (primaryBalanceQ.data?.locked ?? 0);
  const selected = boostersQ.data?.find((b) => b.id === boosterId);
  const amt = Number(amount) || 0;
  const boosterCost = selected ? Number(selected.cost_seed) : 0;
  // Total deducted from farming wallet = investment amount + booster cost
  const totalRequired = amt + boosterCost;
  const projectedReward = selected ? (amt * selected.reward_bps) / 10000 : 0;
  const insufficientFunds = totalRequired > balance;

  const handleStartClick = () => {
    if (!boosterId || amt <= 0 || insufficientFunds) return;
    setConfirmOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sprout className="h-3.5 w-3.5" /> Farming
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Farming Cycles</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Lock Seeds into a cycle, wait for it to mature, then reap your principal plus reward.
          </p>
        </div>

        {/* Fund / Withdraw — moved to header right */}
        <div className="flex shrink-0 items-center gap-2">
          <TransferToFarmingDialog
            primaryAvailableUsdt={primaryAvailableUsdt}
            rate={rate}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["farming-balance"] });
              qc.invalidateQueries({ queryKey: ["primary-balance"] });
            }}
            trigger={
              <Button size="sm" variant="outline" type="button">
                <WalletIcon className="mr-1.5 h-3.5 w-3.5" />
                Fund Wallet
              </Button>
            }
          />
          <TransferToPrimaryDialog
            farmingAvailableSeed={balance}
            rate={rate}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["farming-balance"] });
              qc.invalidateQueries({ queryKey: ["primary-balance"] });
            }}
            trigger={
              <Button size="sm" variant="outline" type="button">
                Withdraw
              </Button>
            }
          />
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">

        {/* Start a cycle card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sprout className="h-4 w-4 text-primary" /> Start a cycle
            </CardTitle>
            {/* Balance row — no longer has buttons, just shows balance */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <WalletIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Balance:</span>
              <span className="font-medium">{seedWithUsdt(balance, rate)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <div className="grid grid-cols-2 gap-2">
                {boostersQ.data?.map((b) => (
                  <BoosterTile key={b.id} booster={b} rate={rate} selected={b.id === boosterId} onSelect={() => setBoosterId(b.id)} />
                ))}
                {!boostersQ.data?.length && boostersQ.isLoading && (
                  <div className="skeleton col-span-2 h-20 rounded-lg" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount to invest (Seed)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 100"
              />
              <div className="flex flex-wrap gap-1.5">
                {[10, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={balance <= 0}
                    onClick={() => {
                      const v = (balance * pct) / 100;
                      setAmount(v > 0 ? v.toFixed(2) : "");
                    }}
                    className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
                  >
                    {pct === 100 ? "Max" : `${pct}%`}
                  </button>
                ))}
              </div>
              {amt > 0 && (
                <p className="text-xs text-muted-foreground">≈ {fmtAmount(seedToUsdt(amt, rate))} USDT</p>
              )}
              {selected && amt > 0 && (
                <p className="text-xs text-muted-foreground">
                  Projected reward:{" "}
                  <span className="font-medium text-foreground">{seedWithUsdt(projectedReward, rate)}</span>{" "}
                  ({bpsToPct(selected.reward_bps)})
                </p>
              )}
            </div>

            {selected && amt > 0 && boosterCost > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Investment amount</span>
                  <span>{fmt(amt)} Seed</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Booster cost ({selected.label})</span>
                  <span>+ {fmt(boosterCost)} Seed</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                  <span>Total required</span>
                  <span>{fmt(totalRequired)} Seed</span>
                </div>
              </div>
            )}

            {insufficientFunds && amt > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Insufficient balance.{" "}
                  {boosterCost > 0
                    ? `You need ${fmt(totalRequired)} Seed (${fmt(amt)} investment + ${fmt(boosterCost)} booster cost) but only have ${fmt(balance)} Seed.`
                    : `You need ${fmt(amt)} Seed but only have ${fmt(balance)} Seed.`}
                </span>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!boosterId || amt <= 0 || insufficientFunds || startMut.isPending}
              onClick={handleStartClick}
            >
              {startMut.isPending ? "Starting…" : "Start cycle"}
            </Button>
          </CardContent>
        </Card>

        {/* Stats card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Your farming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FarmingStats cycles={cyclesQ.data ?? []} balance={balance} rate={rate} />
          </CardContent>
        </Card>
      </div>

      {/* ── Cycles section with filter / sort / pagination ─────────── */}
      <CyclesSection
        cycles={cyclesQ.data ?? []}
        isLoading={cyclesQ.isLoading}
        rate={rate}
        onReap={(id) => reapMut.mutate(id)}
        reaping={reapMut.isPending}
      />

      {/* Confirmation dialog */}
      {selected && (
        <StartCycleDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          booster={selected}
          amount={amt}
          boosterCost={boosterCost}
          totalRequired={totalRequired}
          projectedReward={projectedReward}
          balance={balance}
          rate={rate}
          isPending={startMut.isPending}
          onConfirm={() => startMut.mutate({ boosterId, amount: amt })}
        />
      )}

      {/* Premium nag modal */}
      <PremiumNagModal
        storageKey="nag-farm"
        isStandard={isStandard}
        headline="Your farming rewards could be higher."
        subheadline="Premium Farmers earn a bonus percentage on top of every cycle reward — automatically applied at reap time."
        benefits={[
          { emoji: "🌾", title: "Bonus farming yield", body: "Premium members earn an extra percentage on every cycle they reap, with no extra effort." },
          { emoji: "⚡", title: "Stacks with boosters", body: "The premium farming bonus stacks on top of your booster multiplier for maximum returns." },
          { emoji: "💰", title: "3-generation commissions", body: "When your referrals reap, you earn from Gens 1, 2 & 3 — not just Gen 1." },
          { emoji: "🏷️", title: "Lower withdrawal fee", body: "Keep more of every USDT you earn with the reduced premium withdrawal rate." },
        ]}
        ctaLabel="Boost My Returns"
      />
    </div>
  );
}

// ── CyclesSection — filtered, sorted, paginated with lazy-load ────────────

type FilterTab = "ongoing" | "completed" | "cancelled";
type SortKey = "started_at" | "amount" | "reward";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 5;

function CyclesSection({
  cycles,
  isLoading,
  rate,
  onReap,
  reaping,
}: {
  cycles: Cycle[];
  isLoading: boolean;
  rate: number;
  onReap: (id: string) => void;
  reaping: boolean;
}) {
  const [filter, setFilter] = useState<FilterTab>("ongoing");
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Lazy-load: only show rows up to page * PAGE_SIZE
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Map filter tab → cycle statuses
  const statusMap: Record<FilterTab, string[]> = {
    ongoing: ["active", "matured"],
    completed: ["reaped"],
    cancelled: ["cancelled"],
  };

  const filtered = useMemo(() => {
    const allowed = statusMap[filter];
    return cycles.filter((c) => allowed.includes(c.status));
  }, [cycles, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "started_at") {
        av = new Date(a.started_at).getTime();
        bv = new Date(b.started_at).getTime();
      } else if (sortKey === "amount") {
        av = Number(a.amount);
        bv = Number(b.amount);
      } else {
        // reward = amount * reward_bps / 10000
        av = (Number(a.amount) * a.reward_bps) / 10000;
        bv = (Number(b.amount) * b.reward_bps) / 10000;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [filtered, sortKey, sortDir]);

  // Reset visible count when filter / sort changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPage(1);
  }, [filter, sortKey, sortDir]);

  // IntersectionObserver for lazy-loading
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < sorted.length) {
          setVisibleCount((v) => Math.min(v + PAGE_SIZE, sorted.length));
        }
      },
      { rootMargin: "100px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, sorted.length]);

  const visible = sorted.slice(0, visibleCount);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const counts: Record<FilterTab, number> = {
    ongoing: cycles.filter((c) => ["active", "matured"].includes(c.status)).length,
    completed: cycles.filter((c) => c.status === "reaped").length,
    cancelled: cycles.filter((c) => c.status === "cancelled").length,
  };

  return (
    <div className="mt-8">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your cycles</h2>

        {/* Sort controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Sort:</span>
          {(["started_at", "amount", "reward"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md border px-2 py-1 font-medium transition-colors",
                sortKey === k
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {k === "started_at" ? "Date" : k === "amount" ? "Amount" : "Reward"}
              {sortKey === k && (
                <ArrowUpDown className="h-3 w-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-3 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {(["ongoing", "completed", "cancelled"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFilter(tab); }}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors",
              filter === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}{" "}
            <span className={cn(
              "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px]",
              filter === tab ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Cycle list */}
      <div className="mt-3 space-y-3">
        {isLoading && (
          <>
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            {filter === "ongoing"
              ? "No active cycles. Lock some Seeds above to get started."
              : filter === "completed"
              ? "No completed cycles yet."
              : "No cancelled cycles."}
          </div>
        )}

        {/* Paginated rows */}
        {!isLoading && pageItems.map((c) => (
          <CycleCard key={c.id} cycle={c} rate={rate} onReap={() => onReap(c.id)} reaping={reaping} />
        ))}

        {/* Lazy-load sentinel (only for infinite-scroll alternative) */}
        <div ref={sentinelRef} />
      </div>

      {/* Pagination controls */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                page === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <span className="ml-2 text-xs text-muted-foreground">
            Page {page} of {totalPages} · {sorted.length} cycle{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── StartCycleDialog ───────────────────────────────────────────────────────
  open,
  onOpenChange,
  booster,
  amount,
  boosterCost,
  totalRequired,
  projectedReward,
  balance,
  rate,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booster: Booster;
  amount: number;
  boosterCost: number;
  totalRequired: number;
  projectedReward: number;
  balance: number;
  rate: number;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const maturesAt = new Date(Date.now() + booster.duration_hours * 3600 * 1000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Confirm farming cycle
          </DialogTitle>
          <DialogDescription>
            Review the details below before locking your Seeds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Plan */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Plan</p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{booster.label}</span>
              <span className="text-primary font-semibold">{bpsToPct(booster.reward_bps)} reward</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {booster.duration_hours}h duration · matures ~{maturesAt.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2 text-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Cost breakdown</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Investment amount</span>
              <div className="text-right">
                <span className="font-medium">{fmt(amount)} Seed</span>
                <span className="ml-1.5 text-xs text-muted-foreground">≈ {fmtAmount(seedToUsdt(amount, rate))} USDT</span>
              </div>
            </div>
            {boosterCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booster cost</span>
                <div className="text-right">
                  <span className="font-medium">+ {fmt(boosterCost)} Seed</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">≈ {fmtAmount(seedToUsdt(boosterCost, rate))} USDT</span>
                </div>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-border pt-2">
              <span>Total deducted</span>
              <div className="text-right">
                <span>{fmt(totalRequired)} Seed</span>
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">≈ {fmtAmount(seedToUsdt(totalRequired, rate))} USDT</span>
              </div>
            </div>
          </div>

          {/* Projected return */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1.5 text-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">At maturity you receive</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal back</span>
              <span>{fmt(amount)} Seed</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reward ({bpsToPct(booster.reward_bps)})</span>
              <span className="text-primary font-medium">+ {fmt(projectedReward)} Seed</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-primary/20 pt-1.5">
              <span>Total return</span>
              <div className="text-right">
                <span className="text-primary">{fmt(amount + projectedReward)} Seed</span>
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">≈ {fmtAmount(seedToUsdt(amount + projectedReward, rate))} USDT</span>
              </div>
            </div>
          </div>

          {/* Balance after */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Farming balance after</span>
            <span className="font-medium text-foreground">{fmt(balance - totalRequired)} Seed</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Starting…" : "Confirm & start cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoosterTile({ booster, rate, selected, onSelect }: { booster: Booster; rate: number; selected: boolean; onSelect: () => void }) {
  const cost = Number(booster.cost_seed);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-3 text-left transition",
        selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 hover:border-primary/50",
      )}
    >
      <div className="text-sm font-medium">{booster.label}</div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {booster.duration_hours}h
        </span>
        <span className="font-medium text-primary">{bpsToPct(booster.reward_bps)}</span>
      </div>
      {cost > 0 && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Cost: {fmt(cost)} Seed (≈ {fmtAmount(seedToUsdt(cost, rate))} USDT)
        </div>
      )}
    </button>
  );
}

function FarmingStats({ cycles, balance, rate }: { cycles: Cycle[]; balance: number; rate: number }) {
  const active = cycles.filter((c) => c.status === "active" || c.status === "matured");
  const locked = active.reduce((s, c) => s + Number(c.amount), 0);
  const pendingReward = active.reduce((s, c) => s + (Number(c.amount) * c.reward_bps) / 10000, 0);
  const reapedReward = cycles
    .filter((c) => c.status === "reaped")
    .reduce((s, c) => s + (Number(c.amount) * c.reward_bps) / 10000, 0);
  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <Stat label="Farming balance" value={`${fmt(balance)} Seed`} sub={`≈ ${fmtAmount(seedToUsdt(balance, rate))} USDT`} />
      <Stat label="Locked in cycles" value={`${fmt(locked)} Seed`} sub={`≈ ${fmtAmount(seedToUsdt(locked, rate))} USDT`} />
      <Stat label="Pending rewards" value={`${fmt(pendingReward)} Seed`} sub={`≈ ${fmtAmount(seedToUsdt(pendingReward, rate))} USDT`} />
      <Stat label="Lifetime rewards" value={`${fmt(reapedReward)} Seed`} sub={`≈ ${fmtAmount(seedToUsdt(reapedReward, rate))} USDT`} />
    </dl>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
      {sub && <dd className="text-[11px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => Math.max(0, new Date(target).getTime() - now), [target, now]);
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "matured";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function CycleCard({ cycle, rate, onReap, reaping }: { cycle: Cycle; rate: number; onReap: () => void; reaping: boolean }) {
  const remaining = useCountdown(cycle.matures_at);
  const matured = remaining === 0 && cycle.status !== "reaped" && cycle.status !== "cancelled";
  const amount = Number(cycle.amount);
  const reward = (amount * cycle.reward_bps) / 10000;
  const total = cycle.duration_hours * 3600 * 1000;
  const elapsed = Math.min(total, total - remaining);
  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 100;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{fmt(amount)} Seed</span>
            <span className="text-xs text-muted-foreground">≈ {fmtAmount(seedToUsdt(amount, rate))} USDT</span>
            <Badge variant={cycle.status === "reaped" ? "secondary" : cycle.status === "cancelled" ? "outline" : matured ? "default" : "outline"}>
              {cycle.status === "reaped" ? "Reaped" : cycle.status === "cancelled" ? "Cancelled" : matured ? "Matured" : "Active"}
            </Badge>
            <span className="text-xs text-muted-foreground">+{bpsToPct(cycle.reward_bps)} · {cycle.duration_hours}h</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {cycle.status === "reaped"
                ? `Reaped ${cycle.reaped_at ? new Date(cycle.reaped_at).toLocaleDateString() : ""}`
                : formatRemaining(remaining)}
            </span>
            <span>Reward: {fmt(reward)} Seed (≈ {fmtAmount(seedToUsdt(reward, rate))} USDT)</span>
          </div>
        </div>
        <div className="shrink-0">
          {matured && (
            <Button size="sm" onClick={onReap} disabled={reaping}>
              {reaping ? "Reaping…" : "Reap"}
            </Button>
          )}
          {cycle.status === "active" && !matured && (
            <Button size="sm" variant="outline" disabled>
              Locked
            </Button>
          )}
          {cycle.status === "cancelled" && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Cancelled
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
