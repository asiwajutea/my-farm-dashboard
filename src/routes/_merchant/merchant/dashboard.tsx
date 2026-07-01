import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightLeft, Coins, Ticket, TrendingUp, Wallet } from "lucide-react";
import { getMerchantWallet, getMerchantLedger, getMyMerchantProfile } from "@/lib/merchant.functions";
import { useSeedRate } from "@/components/wallet/RequestForm";

export const Route = createFileRoute("/_merchant/merchant/dashboard")({
  head: () => ({ meta: [{ title: "Merchant Dashboard · VFarmers" }] }),
  component: MerchantDashboard,
});

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal", transfer_in: "Received",
  transfer_out: "Sent", p2p_in: "Received (P2P)", p2p_out: "Sent (P2P)",
  coupon_redeem: "Coupon redeemed", admin_credit: "Admin credit",
  admin_debit: "Admin debit", adjustment: "Adjustment",
};

export default function MerchantDashboard() {
  const walletFn = useServerFn(getMerchantWallet);
  const ledgerFn = useServerFn(getMerchantLedger);
  const profileFn = useServerFn(getMyMerchantProfile);
  const { data: rate = 1 } = useSeedRate();

  const walletQ = useQuery({ queryKey: ["merchant-wallet"], queryFn: () => walletFn() });
  const ledgerQ = useQuery({ queryKey: ["merchant-ledger"], queryFn: () => ledgerFn() });
  const profileQ = useQuery({ queryKey: ["merchant-profile"], queryFn: () => profileFn() });

  const balance = walletQ.data?.balance ?? 0;
  const available = balance - (walletQ.data?.locked ?? 0);
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
          <Coins className="h-3.5 w-3.5" /> Merchant Portal
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Welcome, <span className="text-gradient-primary">{profileQ.data?.business_name ?? "Merchant"}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your merchant wallet and recent activity.</p>
      </div>

      {/* Wallet card */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Merchant Wallet</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="relative mt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{fmt(balance)}</span>
            <span className="text-sm text-muted-foreground">USDT</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Available: {fmt(available)} USDT · ≈ {fmt(available / rate)} Seed equivalent
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: "/merchant/wallet", icon: Ticket, label: "Redeem Coupon" },
          { to: "/merchant/transfer", icon: ArrowRightLeft, label: "Fund Farmer" },
          { to: "/merchant/wallet", icon: TrendingUp, label: "View History" },
        ].map((a) => (
          <Link
            key={a.label}
            to={a.to as "/merchant/wallet" | "/merchant/transfer"}
            className="glass flex flex-col items-center gap-2 rounded-2xl py-5 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary"
          >
            <a.icon className="h-5 w-5" />
            {a.label}
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        {ledgerQ.isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />)}
          </div>
        ) : !ledgerQ.data?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet. Redeem a coupon to get started.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {ledgerQ.data.slice(0, 8).map((e) => (
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
                  {e.amount >= 0 ? "+" : ""}{fmt(Math.abs(e.amount))}
                  <span className="ml-1 text-[11px] font-normal opacity-70">USDT</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
