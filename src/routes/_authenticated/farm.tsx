import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Sprout, Clock, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

  const [boosterId, setBoosterId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const startMut = useMutation({
    mutationFn: (vars: { boosterId: string; amount: number }) => fnStart({ data: vars }),
    onSuccess: () => {
      toast.success("Cycle started 🌱");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["cycles"] });
      qc.invalidateQueries({ queryKey: ["farming-balance"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to start cycle"),
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
  const projectedReward = selected ? (amt * selected.reward_bps) / 10000 : 0;

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
              <span className="font-medium">{fmt(balance)} Seed</span>
            </div>

            <div className="space-y-2">
              <Label>Plan</Label>
              <div className="grid grid-cols-2 gap-2">
                {boostersQ.data?.map((b) => (
                  <BoosterTile key={b.id} booster={b} selected={b.id === boosterId} onSelect={() => setBoosterId(b.id)} />
                ))}
                {!boostersQ.data?.length && boostersQ.isLoading && (
                  <div className="skeleton col-span-2 h-20 rounded-lg" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (Seed)</Label>
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
              {selected && amt > 0 && (
                <p className="text-xs text-muted-foreground">
                  Projected reward at maturity: <span className="font-medium text-foreground">{fmt(projectedReward)} Seed</span> ({bpsToPct(selected.reward_bps)})
                </p>
              )}
              {amt > balance && (
                <p className="text-xs text-destructive">Amount exceeds your Farming balance.</p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!boosterId || amt <= 0 || amt > balance || startMut.isPending}
              onClick={() => startMut.mutate({ boosterId, amount: amt })}
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
            <FarmingStats cycles={cyclesQ.data ?? []} balance={balance} />
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
            <CycleCard key={c.id} cycle={c} onReap={() => reapMut.mutate(c.id)} reaping={reapMut.isPending} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BoosterTile({ booster, selected, onSelect }: { booster: Booster; selected: boolean; onSelect: () => void }) {
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
    </button>
  );
}

function FarmingStats({ cycles, balance }: { cycles: Cycle[]; balance: number }) {
  const active = cycles.filter((c) => c.status === "active" || c.status === "matured");
  const locked = active.reduce((s, c) => s + Number(c.amount), 0);
  const pendingReward = active.reduce((s, c) => s + (Number(c.amount) * c.reward_bps) / 10000, 0);
  const reapedReward = cycles
    .filter((c) => c.status === "reaped")
    .reduce((s, c) => s + (Number(c.amount) * c.reward_bps) / 10000, 0);
  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <Stat label="Farming balance" value={`${fmt(balance)} Seed`} />
      <Stat label="Locked in cycles" value={`${fmt(locked)} Seed`} />
      <Stat label="Pending rewards" value={`${fmt(pendingReward)} Seed`} />
      <Stat label="Lifetime rewards" value={`${fmt(reapedReward)} Seed`} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
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

function CycleCard({ cycle, onReap, reaping }: { cycle: Cycle; onReap: () => void; reaping: boolean }) {
  const remaining = useCountdown(cycle.matures_at);
  const matured = remaining === 0 && cycle.status !== "reaped" && cycle.status !== "cancelled";
  const reward = (Number(cycle.amount) * cycle.reward_bps) / 10000;
  const total = cycle.duration_hours * 3600 * 1000;
  const elapsed = Math.min(total, total - remaining);
  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 100;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{fmt(Number(cycle.amount))} Seed</span>
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
            <span>Reward: {fmt(reward)} Seed</span>
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
