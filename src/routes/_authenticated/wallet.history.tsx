import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Inbox, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KIND_LABEL, LedgerItem } from "./wallet.index";

export const Route = createFileRoute("/_authenticated/wallet/history")({
  head: () => ({ meta: [{ title: "Transaction History · VFarmers" }] }),
  component: WalletHistoryPage,
});

const PAGE_SIZE = 25;

interface LedgerRow {
  id: string;
  kind: string;
  amount: number;
  memo: string | null;
  created_at: string;
}

// Filter kinds for the tab bar
const FILTER_KINDS: { label: string; kinds: string[] | null }[] = [
  { label: "All", kinds: null },
  { label: "Deposits & Withdrawals", kinds: ["deposit", "withdrawal", "withdrawal_fee"] },
  { label: "Farming", kinds: ["cycle_start", "cycle_reap_principal", "cycle_reap_reward", "booster_apply"] },
  { label: "Transfers", kinds: ["p2p_in", "p2p_out", "p2p_fee", "transfer_in", "transfer_out"] },
  { label: "Affiliate", kinds: ["affiliate_commission", "referral_bonus", "maintenance_fee"] },
  { label: "Other", kinds: ["escrow_lock", "escrow_release", "escrow_refund", "admin_credit", "admin_debit", "coupon_redeem", "fee", "adjustment", "test_credit"] },
];

function WalletHistoryPage() {
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filterIdx, setFilterIdx] = useState(0);
  const offsetRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  const fetchPage = async (userId: string, offset: number, kinds: string[] | null, replace: boolean) => {
    let q = supabase
      .from("ledger_entries")
      .select("id, kind, amount, memo, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (kinds) q = q.in("kind", kinds);

    const { data } = await q;
    const rows = (data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind as string,
      amount: Number(e.amount),
      memo: e.memo,
      created_at: e.created_at,
    }));

    if (replace) {
      setEntries(rows);
    } else {
      setEntries((prev) => [...prev, ...rows]);
    }
    setHasMore(rows.length === PAGE_SIZE);
    offsetRef.current = offset + rows.length;
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    offsetRef.current = 0;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      await fetchPage(user.id, 0, FILTER_KINDS[filterIdx].kinds, true);
      setLoading(false);
    })();
  }, [filterIdx]);

  const loadMore = async () => {
    if (!userIdRef.current || loadingMore) return;
    setLoadingMore(true);
    await fetchPage(userIdRef.current, offsetRef.current, FILTER_KINDS[filterIdx].kinds, false);
    setLoadingMore(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <Link to="/wallet" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transaction History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Full ledger across all your activity.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_KINDS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setFilterIdx(i)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filterIdx === i
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="glass rounded-3xl p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Inbox className="mx-auto mb-2 h-6 w-6" />
            No transactions found.
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Activity</span>
              <span className="text-center">Date / Time</span>
              <span className="text-right">Amount</span>
            </div>
            <ul className="divide-y divide-border/40">
              {entries.map((e) => <LedgerItem key={e.id} entry={e} />)}
            </ul>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-2 text-sm font-medium transition-colors hover:bg-card disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
