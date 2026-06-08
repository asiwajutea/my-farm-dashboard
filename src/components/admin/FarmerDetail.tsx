import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Snowflake, Sun, Wallet, Sprout } from "lucide-react";

import { adminGetFarmer, adminAdjustBalance, adminSetFrozen } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function FarmerDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const getFn = useServerFn(adminGetFarmer);
  const adjustFn = useServerFn(adminAdjustBalance);
  const freezeFn = useServerFn(adminSetFrozen);
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const q = useQuery({ queryKey: ["admin-farmer", userId], queryFn: () => getFn({ data: { userId } }) });
  const detail = q.data;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-farmer", userId] });
    qc.invalidateQueries({ queryKey: ["admin-farmers"] });
  };

  const adjust = useMutation({
    mutationFn: (signed: number) =>
      adjustFn({ data: { userId, amount: signed, memo: memo.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Balance adjusted.");
      setAmount("");
      setMemo("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const freeze = useMutation({
    mutationFn: (frozen: boolean) => freezeFn({ data: { userId, frozen } }),
    onSuccess: () => {
      toast.success("Updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const back = (
    <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to farmers
    </button>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-6">
        {back}
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="space-y-6">
        {back}
        <p className="py-10 text-center text-sm text-muted-foreground">Farmer not found.</p>
      </div>
    );
  }

  const f = detail.farmer;
  const amt = Number(amount) || 0;

  return (
    <div className="space-y-6">
      {back}

      <div className="glass rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
              {(f.display_name ?? f.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{f.display_name ?? f.username ?? "Farmer"}</h2>
              <p className="text-sm text-muted-foreground">
                {f.username ? `@${f.username}` : f.id.slice(0, 8)}
                {detail.isAdmin && <span className="ml-2 text-primary">· Admin</span>}
                {f.frozen && <span className="ml-2 text-sky-400">· Frozen</span>}
              </p>
            </div>
          </div>
          <Button
            variant={f.frozen ? "secondary" : "outline"}
            onClick={() => freeze.mutate(!f.frozen)}
            disabled={freeze.isPending}
          >
            {freeze.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : f.frozen ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Snowflake className="mr-2 h-4 w-4" />
            )}
            {f.frozen ? "Unfreeze" : "Freeze"}
          </Button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Meta label="Country" value={f.country ?? "—"} />
          <Meta label="KYC" value={f.kyc_status} />
          <Meta label="Referral" value={f.referral_code ?? "—"} />
          <Meta label="Joined" value={new Date(f.created_at).toLocaleDateString()} />
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Wallet} label="Primary Wallet" value={`${fmt(f.primary_balance)} Seed`} accent="gold" />
        <StatCard icon={Sprout} label="Farming Wallet" value={`${fmt(f.farming_balance)} Seed`} accent="primary" />
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="text-lg font-semibold">Adjust primary balance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Writes an admin_credit / admin_debit ledger entry and an audit record.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="adj-amount">Amount (Seed)</Label>
            <Input
              id="adj-amount"
              inputMode="decimal"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-memo">Memo (optional)</Label>
            <Input id="adj-memo" maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => adjust.mutate(Math.abs(amt))} disabled={adjust.isPending || amt <= 0}>
              {adjust.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Credit +{fmt(Math.abs(amt))}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => adjust.mutate(-Math.abs(amt))}
              disabled={adjust.isPending || amt <= 0}
            >
              Debit −{fmt(Math.abs(amt))}
            </Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="mb-3 text-lg font-semibold">Recent ledger</h3>
        {detail.recentLedger.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No ledger activity.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {detail.recentLedger.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{e.kind}</div>
                  {e.memo && <div className="truncate text-xs text-muted-foreground">{e.memo}</div>}
                  <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                </div>
                <div className={`font-mono tabular-nums ${e.amount >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {e.amount >= 0 ? "+" : ""}
                  {fmt(e.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}
