import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet as WalletIcon,
  Sprout,
  Inbox,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Loadable } from "@/components/ui/loadable";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet · VFarmers" }] }),
  component: WalletPage,
});

type WalletKind = "primary" | "farming";
interface WalletRow {
  kind: WalletKind;
  balance: number;
  locked: number;
}
interface LedgerRow {
  id: string;
  kind: string;
  amount: number;
  memo: string | null;
  created_at: string;
}

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

function WalletPage() {
  const [wallets, setWallets] = useState<Partial<Record<WalletKind, WalletRow>>>({});
  const [rate, setRate] = useState<number>(1);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: ws }, { data: settings }, { data: entries }] = await Promise.all([
        supabase.from("wallets").select("kind, balance, locked").eq("user_id", user.id),
        supabase.from("app_settings").select("seed_to_usdt").maybeSingle(),
        supabase
          .from("ledger_entries")
          .select("id, kind, amount, memo, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      const map: Partial<Record<WalletKind, WalletRow>> = {};
      for (const w of (ws ?? []) as WalletRow[]) map[w.kind] = w;
      setWallets(map);
      if (settings?.seed_to_usdt) setRate(Number(settings.seed_to_usdt));
      setLedger(
        (entries ?? []).map((e) => ({
          id: e.id,
          kind: e.kind as string,
          amount: Number(e.amount),
          memo: e.memo,
          created_at: e.created_at,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const primarySeed = Number(wallets.primary?.balance ?? 0);
  const farmingSeed = Number(wallets.farming?.balance ?? 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your balances and recent activity.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <WalletCard
          title="Primary Wallet"
          mode="usdt"
          seed={primarySeed}
          rate={rate}
          icon={WalletIcon}
          accent="gold"
          sub="Deposits, withdrawals & P2P"
        />
        <WalletCard
          title="Farming Wallet"
          mode="seed"
          seed={farmingSeed}
          rate={rate}
          icon={Sprout}
          accent="primary"
          sub="Cycles & rewards"
        />
      </section>

      <section className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/deposit"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01]"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Deposit
        </Link>
        <Link
          to="/withdraw"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-5 py-3 text-sm font-semibold transition-colors hover:bg-card"
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Withdraw
        </Link>
      </section>

      <section className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        <Loadable loading={loading} skeleton={<ListSkeleton rows={5} leading="none" />}>
          {!ledger || ledger.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-6 w-6" />
              No activity yet.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {ledger.map((e) => {
                const isPositive = e.amount > 0;
                return (
                  <li key={e.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{KIND_LABEL[e.kind] ?? e.kind}</div>
                      {e.memo && <div className="truncate text-xs text-muted-foreground">{e.memo}</div>}
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div
                      className={`font-mono text-sm tabular-nums ${
                        isPositive ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {e.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Loadable>
      </section>
    </div>
  );
}

function WalletCard({
  title,
  mode,
  seed,
  rate,
  sub,
  accent,
  icon: Icon,
}: {
  title: string;
  mode: "usdt" | "seed";
  seed: number;
  rate: number;
  sub: string;
  accent: "primary" | "gold";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const usdt = seed * rate;
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const main = mode === "usdt" ? fmt(usdt) : fmt(seed);
  const mainUnit = mode === "usdt" ? "USDT" : "Seed";
  const subUnit = mode === "usdt" ? "Seed" : "USDT";
  const subVal = mode === "usdt" ? fmt(seed) : fmt(usdt);
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-6">
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
          accent === "gold" ? "bg-gold/15" : "bg-primary/15"
        }`}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            accent === "gold" ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative mt-5">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{main}</span>
          <span className="text-sm text-muted-foreground">{mainUnit}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          ≈ {subVal} {subUnit} · {sub}
        </div>
      </div>
    </div>
  );
}
