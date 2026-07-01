import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, ArrowRightLeft, Loader2, Search } from "lucide-react";
import { merchantTransferToFarmer, lookupFarmerForMerchant, getMerchantWallet } from "@/lib/merchant.functions";
import { useSeedRate } from "@/components/wallet/RequestForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_merchant/transfer")({
  head: () => ({ meta: [{ title: "Fund Farmer · VFarmers" }] }),
  component: MerchantTransferPage,
});

type Farmer = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };

function MerchantTransferPage() {
  const qc = useQueryClient();
  const transferFn = useServerFn(merchantTransferToFarmer);
  const lookupFn = useServerFn(lookupFarmerForMerchant);
  const walletFn = useServerFn(getMerchantWallet);
  const { data: rate = 1 } = useSeedRate();

  const walletQ = useQuery({ queryKey: ["merchant-wallet"], queryFn: () => walletFn() });

  const [handle, setHandle] = useState("");
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const available = (walletQ.data?.balance ?? 0) - (walletQ.data?.locked ?? 0);
  const amtUsdt = Number(amount) || 0;
  const seedEquiv = rate > 0 ? amtUsdt / rate : 0;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const lookupMut = useMutation({
    mutationFn: (h: string) => lookupFn({ data: { handle: h } }),
    onSuccess: (r, h) => {
      if (!r) { setFarmer(null); setNotFound(h); toast.error(`No farmer found for "${h}".`); return; }
      setNotFound(null); setFarmer(r);
    },
    onError: (_e, h) => { setFarmer(null); setNotFound(h); },
  });

  const transferMut = useMutation({
    mutationFn: () => transferFn({ data: { farmerId: farmer!.id, amountUsdt: amtUsdt, note: note || undefined } }),
    onSuccess: () => {
      toast.success(`Transferred ${fmt(amtUsdt)} USDT → ${fmt(seedEquiv)} Seed to farmer's wallet.`);
      setAmount(""); setNote(""); setFarmer(null); setHandle("");
      qc.invalidateQueries({ queryKey: ["merchant-wallet"] });
      qc.invalidateQueries({ queryKey: ["merchant-ledger"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fund Farmer Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Transfer USDT from your merchant wallet to a farmer's Farming Wallet (converted to Seed at current rate).
        </p>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Your available balance</span>
        <span className="font-semibold tabular-nums">{fmt(available)} USDT</span>
      </div>

      <div className="glass rounded-3xl p-6 space-y-5">
        {/* Farmer lookup */}
        <div className="space-y-2">
          <Label>Farmer (username or referral code)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. alice or AB12CD34"
              value={handle}
              onChange={(e) => { setHandle(e.target.value); setFarmer(null); setNotFound(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (handle.trim()) lookupMut.mutate(handle.trim()); } }}
            />
            <Button type="button" variant="secondary"
              onClick={() => handle.trim() && lookupMut.mutate(handle.trim())}
              disabled={lookupMut.isPending || !handle.trim()}>
              {lookupMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {notFound && !farmer && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> No farmer found for "{notFound}".
            </p>
          )}
          {farmer && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                {(farmer.display_name ?? farmer.username ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{farmer.display_name ?? farmer.username ?? "Farmer"}</div>
                {farmer.username && <div className="text-xs text-muted-foreground">@{farmer.username}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="transfer-amount">Amount (USDT)</Label>
          <div className="flex items-center rounded-xl border border-border bg-background/60 px-3 py-2 focus-within:border-primary/60">
            <input
              id="transfer-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <span className="ml-2 text-xs text-muted-foreground">USDT</span>
          </div>
          {amtUsdt > 0 && (
            <p className="text-xs text-muted-foreground">
              Farmer will receive ≈ <span className="font-medium text-foreground">{fmt(seedEquiv)} Seed</span> at rate 1 Seed = {rate} USDT
            </p>
          )}
          {amtUsdt > available && amtUsdt > 0 && (
            <p className="text-xs text-destructive">Exceeds your available balance ({fmt(available)} USDT).</p>
          )}
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="transfer-note">Note (optional)</Label>
          <Input id="transfer-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Seed top-up for customer" />
        </div>

        {/* Confirm preview */}
        {farmer && amtUsdt > 0 && amtUsdt <= available && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">You send</span>
              <span className="font-semibold">{fmt(amtUsdt)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Farmer receives</span>
              <span className="font-semibold text-primary">{fmt(seedEquiv)} Seed</span>
            </div>
            <div className="flex justify-between text-xs border-t border-border pt-2">
              <span className="text-muted-foreground">Conversion rate</span>
              <span>1 Seed = {rate} USDT</span>
            </div>
          </div>
        )}

        <Button
          className="w-full"
          disabled={!farmer || amtUsdt <= 0 || amtUsdt > available || transferMut.isPending}
          onClick={() => transferMut.mutate()}
        >
          {transferMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
          Transfer to Farmer
        </Button>
      </div>
    </div>
  );
}
