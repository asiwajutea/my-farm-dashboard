import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, Zap, Lock, AlertTriangle } from "lucide-react";
import { RequestForm } from "@/components/wallet/RequestForm";
import { RequestsHistory } from "@/components/wallet/RequestsHistory";
import { IvoryPayButton } from "@/components/wallet/IvoryPayButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getDepositChannelStatus } from "@/lib/deposit-channels.functions";

const searchSchema = z.object({
  ivorypay:  z.string().optional(),  // "success" when returning from IvoryPay checkout
  ref:       z.string().optional(),  // our deposit request UUID
  reference: z.string().optional(),  // IvoryPay may also append their own ?reference= param
});

export const Route = createFileRoute("/_authenticated/deposit")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Deposit · VFarmers" }] }),
  component: DepositPage,
});

function DepositPage() {
  const search = useSearch({ from: "/_authenticated/deposit" });
  const channelStatusFn = useServerFn(getDepositChannelStatus);

  const { data: channelStatus } = useQuery({
    queryKey: ["deposit-channel-status"],
    queryFn: () => channelStatusFn(),
    staleTime: 60_000,
  });

  // IvoryPay is locked if disabled by admin OR daily limit reached
  const ivoryLocked =
    channelStatus?.ivorypay.enabled === false ||
    channelStatus?.ivorypay.limitReached === true;
  const ivoryLockReason = channelStatus?.ivorypay.limitReached
    ? `Daily deposit limit of ${channelStatus.ivorypay.dailyLimitUsdt.toFixed(0)} USDT reached. Try again tomorrow.`
    : (channelStatus?.ivorypay.lockedReason ?? "IvoryPay deposits are currently unavailable.");

  const manualLocked    = channelStatus?.manual.enabled === false;
  const manualLockReason = channelStatus?.manual.lockedReason ?? "Manual deposits are currently unavailable.";

  // If returning from IvoryPay, default to the IvoryPay tab and pass the
  // deposit request ID so the component can resume polling immediately.
  // Sanitise the ref — strip any trailing characters IvoryPay may have appended.
  const rawRef = search.ref;
  const cleanRef = rawRef?.split("&")[0]?.split("?")[0]?.trim();
  const returningFromIvoryPay = search.ivorypay === "success" && !!cleanRef;
  const [tab, setTab] = useState<"manual" | "ivorypay">(
    returningFromIvoryPay ? "ivorypay" : "ivorypay",
  );

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ArrowDownToLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Deposit USDT</h1>
          <p className="text-sm text-muted-foreground">
            Top up your Primary Wallet. Funds are credited automatically via IvoryPay or manually after admin review.
          </p>
        </div>
      </header>

      {/* Method tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setTab("ivorypay")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === "ivorypay"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="h-3.5 w-3.5 text-primary" />
          Instant · IvoryPay
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === "manual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Manual transfer
        </button>
      </div>

      {tab === "ivorypay" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Pay with IvoryPay
            </CardTitle>
            <CardDescription>
              Send USDT directly — your wallet is credited automatically once the blockchain confirms. No admin review needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ivoryLocked ? (
              <LockedChannel reason={ivoryLockReason} />
            ) : (
              <IvoryPayButton
                minUsdt={1}
                resumeDepositId={returningFromIvoryPay ? cleanRef : undefined}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Manual deposit</CardTitle>
            <CardDescription>
              Enter the amount in USDT and attach a payment screenshot. An admin will review and approve within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {manualLocked ? (
              <LockedChannel reason={manualLockReason} />
            ) : (
              <RequestForm type="deposit" minUsdt={1} hint="Enter the USDT amount you're depositing." />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestsHistory filter="deposit" />
        </CardContent>
      </Card>
    </div>
  );
}

function LockedChannel({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
        <Lock className="h-6 w-6 text-amber-400" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Channel unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-amber-400/80">
        <AlertTriangle className="h-3.5 w-3.5" />
        Please check back later or use another deposit method.
      </div>
    </div>
  );
}
