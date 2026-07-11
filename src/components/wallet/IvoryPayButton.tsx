/**
 * IvoryPayButton
 *
 * Renders the IvoryPay deposit form as a self-contained card:
 *   1. User picks amount + network
 *   2. Clicks "Pay with IvoryPay" → server creates a transaction → opens the IvoryPay checkout
 *   3. After payment, IvoryPay redirects back and the webhook credits the wallet automatically
 *   4. A polling mechanism detects completion as a fallback
 */

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ExternalLink, CheckCircle2, XCircle, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { initiateIvoryPayDeposit, checkIvoryPayDeposit } from "@/lib/ivorypay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NETWORKS = [
  { value: "tron",     label: "USDT — TRC20 (Tron)",    fee: "Low fees · Fast" },
  { value: "ethereum", label: "USDT — ERC20 (Ethereum)", fee: "Higher fees · Slower" },
  { value: "bsc",      label: "USDT — BEP20 (BSC)",      fee: "Low fees · Fast" },
] as const;

type Network = typeof NETWORKS[number]["value"];
type DepositStatus = "idle" | "pending" | "processing" | "approved" | "rejected";

interface Props {
  minUsdt?: number;
}

export function IvoryPayButton({ minUsdt = 1 }: Props) {
  const initiateFn = useServerFn(initiateIvoryPayDeposit);
  const checkFn   = useServerFn(checkIvoryPayDeposit);
  const qc = useQueryClient();

  const [amount, setAmount]   = useState("");
  const [network, setNetwork] = useState<Network>("tron");
  const [depositId, setDepositId] = useState<string | null>(null);
  const [status, setStatus]   = useState<DepositStatus>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Create transaction ───────────────────────────────────────────────────
  const initiate = useMutation({
    mutationFn: () =>
      initiateFn({
        data: {
          amountUsdt: Number(amount),
          network,
        },
      }),
    onSuccess: ({ paymentUrl, depositRequestId }) => {
      setDepositId(depositRequestId);
      setStatus("pending");
      // Open IvoryPay checkout in a new tab
      window.open(paymentUrl, "_blank", "noopener,noreferrer");
      toast.success("IvoryPay checkout opened — complete your payment there.");
      startPolling(depositRequestId);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
    },
  });

  // ── Polling — check deposit status every 10 s after payment initiated ────
  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result = await checkFn({ data: { depositRequestId: id } });
        if (result.status === "approved") {
          clearPolling();
          setStatus("approved");
          toast.success("Deposit confirmed! Your wallet has been credited.");
          qc.invalidateQueries({ queryKey: ["my-requests"] });
          qc.invalidateQueries({ queryKey: ["seed-rate"] });
        } else if (result.status === "rejected") {
          clearPolling();
          setStatus("rejected");
          toast.error("Payment failed or expired. Please try again.");
        } else if (result.status === "processing") {
          setStatus("processing");
        }
      } catch {
        // Non-fatal — keep polling
      }
    }, 10_000);
  }

  function clearPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => () => clearPolling(), []);

  // ── Manual recheck button ────────────────────────────────────────────────
  const [rechecking, setRechecking] = useState(false);
  async function manualRecheck() {
    if (!depositId) return;
    setRechecking(true);
    try {
      const result = await checkFn({ data: { depositRequestId: depositId } });
      if (result.status === "approved") {
        clearPolling();
        setStatus("approved");
        toast.success("Deposit confirmed!");
        qc.invalidateQueries({ queryKey: ["my-requests"] });
      } else if (result.status === "rejected") {
        clearPolling();
        setStatus("rejected");
        toast.error("Payment failed or expired.");
      } else {
        toast.info(result.status === "processing" ? "Payment is being processed…" : "Payment not detected yet — please wait.");
        setStatus(result.status as DepositStatus);
      }
    } catch (e) {
      toast.error("Check failed. Please try again.");
    } finally {
      setRechecking(false);
    }
  }

  function reset() {
    clearPolling();
    setStatus("idle");
    setDepositId(null);
    setAmount("");
  }

  const amountNum = Number(amount);
  const invalid = !amount || amountNum < minUsdt || !Number.isFinite(amountNum);

  // ── Render ───────────────────────────────────────────────────────────────

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <div>
          <p className="font-semibold text-foreground">Deposit confirmed!</p>
          <p className="mt-1 text-sm text-muted-foreground">Your Primary Wallet has been credited.</p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>Make another deposit</Button>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold text-foreground">Payment failed or expired</p>
          <p className="mt-1 text-sm text-muted-foreground">No funds were deducted. Please try again.</p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
      </div>
    );
  }

  if (status === "pending" || status === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/40 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <p className="font-semibold text-foreground">
            {status === "processing" ? "Processing payment…" : "Waiting for payment"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "processing"
              ? "Your transaction is on-chain. We'll credit your wallet once confirmed."
              : "Complete your payment in the IvoryPay checkout tab. This page will update automatically."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={manualRecheck}
            disabled={rechecking}
          >
            {rechecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Check now
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Checking automatically every 10 seconds.</p>
      </div>
    );
  }

  // idle — show the form
  return (
    <div className="space-y-4">
      {/* Network badge */}
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <Zap className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Pay instantly with <span className="font-semibold text-foreground">USDT</span> via IvoryPay.
          Funds are credited automatically after blockchain confirmation.
        </p>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="ivory-amount">Amount (USDT)</Label>
        <Input
          id="ivory-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={minUsdt}
          placeholder={`${minUsdt}.00`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {amountNum > 0 && amountNum < minUsdt && (
          <p className="text-xs text-destructive">Minimum is {minUsdt} USDT</p>
        )}
      </div>

      {/* Network */}
      <div className="space-y-1.5">
        <Label htmlFor="ivory-network">Network</Label>
        <Select value={network} onValueChange={(v) => setNetwork(v as Network)}>
          <SelectTrigger id="ivory-network">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NETWORKS.map((n) => (
              <SelectItem key={n.value} value={n.value}>
                <span className="font-medium">{n.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{n.fee}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className="w-full gap-2"
        onClick={() => initiate.mutate()}
        disabled={initiate.isPending || invalid}
      >
        {initiate.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Opening checkout…</>
        ) : (
          <><ExternalLink className="h-4 w-4" /> Pay {amount ? `${Number(amount).toFixed(2)} USDT` : ""} with IvoryPay</>
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        You will be redirected to IvoryPay's secure payment page. Do not close this tab.
      </p>
    </div>
  );
}
