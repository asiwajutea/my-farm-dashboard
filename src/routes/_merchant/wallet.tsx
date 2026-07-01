import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Ticket, Wallet } from "lucide-react";
import { getMerchantWallet, getMerchantLedger, merchantRedeemCoupon } from "@/lib/merchant.functions";
import { useSeedRate } from "@/components/wallet/RequestForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_merchant/wallet")({
  head: () => ({ meta: [{ title: "Merchant Wallet · VFarmers" }] }),
  component: MerchantWalletPage,
});

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal",
  transfer_in: "Received", transfer_out: "Sent",
  p2p_in: "Received (P2P)", p2p_out: "Sent (P2P)",
  coupon_redeem: "Coupon redeemed", admin_credit: "Admin credit",
  admin_debit: "Admin debit", adjustment: "Adjustment",
};

function MerchantWalletPage() {
  const qc = useQueryClient();
  const walletFn = useServerFn(getMerchantWallet);
  const ledgerFn = useServerFn(getMerchantLedger);
  const redeemFn = useServerFn(merchantRedeemCoupon);
  const { data: rate = 1 } = useSeedRate();

  const walletQ = useQuery({ queryKey: ["merchant-wallet"], queryFn: () => walletFn() });
  const ledgerQ = useQuery({ queryKey: ["merchant-ledger"], queryFn: () => ledgerFn() });

  const [code, setCode] = useState("");

  const redeemMut = useMutation({
    mutationFn: () => redeemFn({ data: { code: code.trim().toUpperCase() } }),
    onSuccess: () => {
      toast.success("Coupon redeemed! USDT credited to your wallet.");
      setCode("");
      qc.invalidateQueries({ queryKey: ["merchant-wallet"] });
      qc.invalidateQueries({ queryKey: ["merchant-ledger"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = walletQ.data?.balance ?? 0;
  const available = balance - (walletQ.data?.locked ?? 0);
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Merchant Wallet</h1>
        <p className="text-sm text-muted-foreground">Your USDT balance and transaction history.</p>
      </div>

      {/* Balance card */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Merchant Wallet (USDT)</span>
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

      {/* Redeem coupon */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Redeem Coupon</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Enter a merchant coupon code to top up your USDT wallet.
        </p>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="coupon-code">Coupon Code</Label>
            <Input
              id="coupon-code"
              placeholder="e.g. MCH-ABCD1234"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => redeemMut.mutate()}
            disabled={redeemMut.isPending || !code.trim()}
          >
            {redeemMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
            Redeem Coupon
          </Button>
        </div>
      </div>

      {/* Transaction history */}
      <div className="glass rounded-3xl p-6">
        <h2 className="mb-3 text-lg font-semibold">Transaction History</h2>
        {ledgerQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !ledgerQ.data?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Activity</span>
              <span className="text-center">Date / Time</span>
              <span className="text-right">Amount</span>
            </div>
            <ul className="divide-y divide-border/40">
              {ledgerQ.data.map((e) => (
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
          </>
        )}
      </div>
    </div>
  );
}
