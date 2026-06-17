import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Sprout, Clock, TrendingUp, Wallet as WalletIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
        <Sprout className="h-3.5 w-3.5" /> Phase 4 · Farming
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Farming Cycles</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Lock Seeds from your Farming wallet into a cycle. When it matures, reap your principal plus the reward.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Start a cycle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sprout className="h-4 w-4 text-primary" /> Start a cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <WalletIcon className="h-3.5 w-3.5" /> Farming balance
              </span>
              <span className="font-medium">{seedWithUsdt(balance, rate)}</span>
            </div>

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

            {/* Cost breakdown — shown when a booster with a cost is selected and amount is entered */}
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

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Your farming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FarmingStats cycles={cyclesQ.data ?? []} balance={balance} rate={rate} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Your cycles</h2>
        <div className="space-y-3">
          {cyclesQ.isLoading && (
            <div className="space-y-3">
              <div className="skeleton h-24 rounded-2xl" />
              <div className="skeleton h-24 rounded-2xl" />
            </div>
          )}
          {!cyclesQ.isLoading && (cyclesQ.data?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No cycles yet. Lock some Seeds above to plant your first one.
            </div>
          )}
          {cyclesQ.data?.map((c) => (
            <CycleCard key={c.id} cycle={c} rate={rate} onReap={() => reapMut.mutate(c.id)} reaping={reapMut.isPending} />
          ))}
        </div>
      </div>

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
    </div>
  );
}

function StartCycleDialog({
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
            <Badge variant={cycle.status === "reaped" ? "secondary" : matured ? "default" : "outline"}>
              {cycle.status === "reaped" ? "Reaped" : matured ? "Matured" : "Active"}
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
        </div>
      </CardContent>
    </Card>
  );
}
