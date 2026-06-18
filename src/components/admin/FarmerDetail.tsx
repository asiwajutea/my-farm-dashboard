import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Snowflake, Sprout, Sun, Wallet } from "lucide-react";

import { adminGetFarmer, adminAdjustBalance, adminSetFrozen, adminGetFarmerLedger } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { useSeedRate } from "@/components/wallet/RequestForm";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUsdt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal", withdrawal_fee: "Withdrawal fee",
  transfer_in: "Transfer in", transfer_out: "Transfer out",
  p2p_in: "Received", p2p_out: "Sent", p2p_fee: "P2P fee",
  cycle_start: "Cycle started", cycle_reap_principal: "Cycle principal", cycle_reap_reward: "Cycle reward",
  booster_apply: "Booster applied", coupon_redeem: "Coupon redeemed", referral_bonus: "Referral bonus",
  escrow_lock: "Escrow locked", escrow_release: "Escrow released", escrow_refund: "Escrow refunded",
  admin_credit: "Admin credit", admin_debit: "Admin debit", fee: "Fee",
  adjustment: "Adjustment", test_credit: "Test credit", affiliate_commission: "Affiliate commission",
  maintenance_fee: "Maintenance fee",
};

const PAGE_SIZE = 10;

export function FarmerDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const getFn = useServerFn(adminGetFarmer);
  const adjustFn = useServerFn(adminAdjustBalance);
  const freezeFn = useServerFn(adminSetFrozen);
  const ledgerFn = useServerFn(adminGetFarmerLedger);
  const qc = useQueryClient();
  const { data: rate = 1 } = useSeedRate();

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [ledgerPage, setLedgerPage] = useState(0);

  const q = useQuery({ queryKey: ["admin-farmer", userId], queryFn: () => getFn({ data: { userId } }) });
  const ledgerQ = useQuery({
    queryKey: ["admin-farmer-ledger", userId, ledgerPage],
    queryFn: () => ledgerFn({ data: { userId, offset: ledgerPage * PAGE_SIZE, limit: PAGE_SIZE } }),
  });
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
        <DetailSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
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
  const amtUsdt = Number(amount) || 0;
  // The ledger and adjust RPC are Seed-denominated; convert USDT → Seed
  const amtSeed = rate > 0 ? amtUsdt / rate : 0;

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
        <StatCard icon={Wallet} label="Primary Wallet" value={`${fmtUsdt(f.primary_balance * rate)} USDT`} hint={`≈ ${fmt(f.primary_balance)} Seed`} accent="gold" />
        <StatCard icon={Sprout} label="Farming Wallet" value={`${fmt(f.farming_balance)} Seed`} accent="primary" />
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="text-lg font-semibold">Adjust primary balance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Writes an admin_credit / admin_debit ledger entry and an audit record.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="adj-amount">Amount (USDT)</Label>
            <div className="flex items-center rounded-xl border border-border bg-background/60 px-3 py-2 focus-within:border-primary/60">
              <input
                id="adj-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">USDT</span>
            </div>
            {amtUsdt > 0 && (
              <p className="text-[11px] text-muted-foreground">
                ≈ {fmt(amtSeed)} Seed will be credited/debited from the ledger
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-memo">Memo (optional)</Label>
            <Input id="adj-memo" maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => adjust.mutate(Math.abs(amtSeed))} disabled={adjust.isPending || amtUsdt <= 0}>
              {adjust.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Credit +{fmtUsdt(Math.abs(amtUsdt))} USDT
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => adjust.mutate(-Math.abs(amtSeed))}
              disabled={adjust.isPending || amtUsdt <= 0}
            >
              Debit −{fmtUsdt(Math.abs(amtUsdt))} USDT
            </Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ledger</h3>
          {/* Page info */}
          <span className="text-xs text-muted-foreground">
            Page {ledgerPage + 1}
          </span>
        </div>

        {ledgerQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !ledgerQ.data || ledgerQ.data.rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No ledger activity.</p>
        ) : (
          <>
            {/* Column headers */}
            <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Activity</span>
              <span className="text-center">Date / Time</span>
              <span className="text-right">Amount</span>
            </div>
            <ul className="divide-y divide-border/40">
              {ledgerQ.data.rows.map((e) => (
                <li key={e.id} className="grid grid-cols-3 items-center gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{KIND_LABEL[e.kind] ?? e.kind}</div>
                    {e.memo && <div className="truncate text-xs text-muted-foreground">{e.memo}</div>}
                  </div>
                  <div className="text-center text-[11px] leading-tight text-muted-foreground">
                    <div>{new Date(e.created_at).toLocaleDateString()}</div>
                    <div>{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className={`text-right font-mono text-sm tabular-nums ${e.amount >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {e.amount >= 0 ? "+" : ""}{fmt(e.amount)}
                    <span className="ml-1 text-[11px] font-normal opacity-70">Seed</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                disabled={ledgerPage === 0 || ledgerQ.isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {ledgerPage * PAGE_SIZE + 1}–{ledgerPage * PAGE_SIZE + ledgerQ.data.rows.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLedgerPage((p) => p + 1)}
                disabled={!ledgerQ.data.hasMore || ledgerQ.isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
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
