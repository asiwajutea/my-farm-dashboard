/**
 * IvoryPayButton — instant USDT deposit via IvoryPay CHECKOUT mode.
 *
 * Flow:
 *   1. User enters USDT amount → clicks Pay
 *   2. Server creates IvoryPay CHECKOUT transaction → returns checkoutUrl
 *   3. User is redirected to IvoryPay's hosted checkout page (they pick crypto/network there)
 *   4. After payment, IvoryPay webhook credits the wallet automatically
 *   5. Polling detects completion as a fallback
 */

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ExternalLink, CheckCircle2, XCircle, RefreshCw, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import { initiateIvoryPayDeposit, checkIvoryPayDeposit } from "@/lib/ivorypay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DepositStatus = "idle" | "pending" | "processing" | "approved" | "rejected";

interface Props {
  minUsdt?: number;
}

export function IvoryPayButton({ minUsdt = 1 }: Props) {
  const initiateFn = useServerFn(initiateIvoryPayDeposit);
  const checkFn    = useServerFn(checkIvoryPayDeposit);
  const qc = useQueryClient();

  const [amount, setAmount]     = useState("");
  const [depositId, setDepositId] = useState<string | null>(null);
  const [status, setStatus]     = useState<DepositStatus>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initiate payment ──────────────────────────────────────────────────────
  const initiate = useMutation({
    mutationFn: () =>
      initiateFn({ data: { amountUsdt: Number(amount) } }),
    onSuccess: ({ checkoutUrl, depositRequestId }) => {
      setDepositId(depositRequestId);
      setStatus("pending");
      // Open IvoryPay hosted checkout in a new tab
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      toast.success("IvoryPay checkout opened. Complete your payment there.");
      startPolling(depositRequestId);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
    },
  });

  // ── Poll every 10 s for status ────────────────────────────────────────────
  function startPolling(id: string) {
    clearPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await checkFn({ data: { depositRequestId: id } });
        if (result.status === "approved") {
          clearPolling();
          setStatus("approved");
          toast.success("Deposit confirmed! Your wallet has been credited.");
          qc.invalidateQueries({ queryKey: ["my-requests"] });
        } else if (result.status === "rejected") {
          clearPolling();
          setStatus("rejected");
          toast.error("Payment failed or expired. Please try again.");
        } else if (result.status === "processing") {
          setStatus("processing");
        }
      } catch { /* non-fatal */ }
    }, 10_000);
  }

  function clearPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => () => clearPolling(), []);

  // ── Manual recheck ────────────────────────────────────────────────────────
  const [rechecking, setRechecking] = useState(false);
  async function manualRecheck() {
    if (!depositId) return;
    setRechecking(true);
    try {
      const result = await checkFn({ data: { depositRequestId: depositId } });
      if (result.status === "approved") {
        clearPolling(); setStatus("approved");
        toast.success("Deposit confirmed!");
        qc.invalidateQueries({ queryKey: ["my-requests"] });
      } else if (result.status === "rejected") {
        clearPolling(); setStatus("rejected");
        toast.error("Payment failed or expired.");
      } else {
        toast.info(
          result.status === "processing"
            ? "Payment is being processed on-chain…"
            : "Payment not detected yet. Please wait a moment."
        );
        setStatus(result.status);
      }
    } catch { toast.error("Check failed. Please try again."); }
    finally { setRechecking(false); }
  }

  function reset() {
    clearPolling(); setStatus("idle"); setDepositId(null); setAmount("");
  }

  const amountNum = Number(amount);
  const invalid = !amount || amountNum < minUsdt || !Number.isFinite(amountNum);

  // ── States ────────────────────────────────────────────────────────────────

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <div>
          <p className="font-semibold">Deposit confirmed!</p>
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
          <p className="font-semibold">Payment failed or expired</p>
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
          <p className="font-semibold">
            {status === "processing" ? "Processing on-chain…" : "Waiting for payment"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "processing"
              ? "Your transaction is confirmed on-chain. Crediting your wallet…"
              : "Complete your payment in the IvoryPay tab. This page updates automatically."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={manualRecheck} disabled={rechecking}>
            {rechecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Check now
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">Cancel</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Auto-checking every 10 seconds.</p>
      </div>
    );
  }

  // ── Idle — form ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Pay with <span className="font-semibold text-foreground">USDT</span> via IvoryPay.
          You'll choose your preferred network (TRC20, ERC20, BEP20) on their secure checkout page.
          Funds are credited automatically after blockchain confirmation.
        </p>
      </div>

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

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Shield className="h-3 w-3" />
        Secured by IvoryPay — you will be redirected to their checkout page.
      </div>
    </div>
  );
}
