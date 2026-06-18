import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Inbox,
  History as HistoryIcon,
} from "lucide-react";

import { listLedger, type LedgerEntry } from "@/lib/history.functions";
import { RateChart } from "@/components/history/RateChart";
import { Loadable } from "@/components/ui/loadable";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Transaction History · VFarmers" }] }),
  component: HistoryPage,
});

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  withdrawal_fee: "Withdrawal fee",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  p2p_in: "Received",
  p2p_out: "Sent",
  p2p_fee: "P2P fee",
  cycle_start: "Cycle started",
  cycle_reap_principal: "Cycle principal",
  cycle_reap_reward: "Cycle reward",
  booster_apply: "Booster applied",
  coupon_redeem: "Coupon redeemed",
  referral_bonus: "Referral bonus",
  escrow_lock: "Escrow locked",
  escrow_release: "Escrow released",
  escrow_refund: "Escrow refunded",
  admin_credit: "Admin credit",
  admin_debit: "Admin debit",
  fee: "Fee",
  adjustment: "Adjustment",
  test_credit: "Test credit",
};

const KIND_OPTIONS = ["all", ...Object.keys(KIND_LABEL)];

function HistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState<"created_at" | "amount">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [wallet, setWallet] = useState<"all" | "primary" | "farming">("all");
  const [kind, setKind] = useState<string>("all");

  const fn = useServerFn(listLedger);
  const q = useQuery({
    queryKey: ["ledger", page, pageSize, sortBy, sortDir, wallet, kind],
    queryFn: () => fn({ data: { page, pageSize, sortBy, sortDir, wallet, kind } }),
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(col: "created_at" | "amount") {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
          <HistoryIcon className="h-3.5 w-3.5" />
          Transaction history
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">All activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every credit and debit across your wallets, plus live Seed-to-USDT rate.
        </p>
      </header>

      <RateChart />

      <section className="glass space-y-4 rounded-3xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Wallet</label>
            <Select value={wallet} onValueChange={(v) => { setWallet(v as typeof wallet); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wallets</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="farming">Farming</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</label>
            <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k === "all" ? "All types" : KIND_LABEL[k] ?? k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {total.toLocaleString()} {total === 1 ? "entry" : "entries"}
          </div>
        </div>

        <Loadable
          loading={q.isLoading && !q.data}
          skeleton={<ListSkeleton rows={8} leading="none" />}
        >
          {rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-6 w-6" />
              No transactions match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("created_at")}
                      >
                        Date
                        {sortBy === "created_at" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="py-2 pr-3">Wallet</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Memo</th>
                    <th className="py-2 pr-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("amount")}
                      >
                        Amount
                        {sortBy === "amount" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Row key={r.id} entry={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Loadable>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || q.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || q.isFetching}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ entry }: { entry: LedgerEntry }) {
  const positive = entry.amount > 0;
  return (
    <tr className="border-b border-border/20 last:border-0">
      <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(entry.created_at).toLocaleString()}
      </td>
      <td className="py-3 pr-3">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
            entry.wallet_kind === "primary"
              ? "border-gold/30 bg-gold/10 text-gold"
              : "border-primary/30 bg-primary/10 text-primary",
          )}
        >
          {entry.wallet_kind}
        </span>
      </td>
      <td className="py-3 pr-3 font-medium">{KIND_LABEL[entry.kind] ?? entry.kind}</td>
      <td className="py-3 pr-3 text-xs text-muted-foreground max-w-xs truncate">
        {entry.memo ?? "—"}
      </td>
      <td
        className={cn(
          "py-3 pr-3 text-right font-mono tabular-nums",
          positive ? "text-primary" : "text-muted-foreground",
        )}
      >
        {positive ? "+" : ""}
        {entry.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
      </td>
    </tr>
  );
}