import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, Zap } from "lucide-react";
import { RequestForm } from "@/components/wallet/RequestForm";
import { RequestsHistory } from "@/components/wallet/RequestsHistory";
import { IvoryPayButton } from "@/components/wallet/IvoryPayButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({ meta: [{ title: "Deposit · VFarmers" }] }),
  component: DepositPage,
});

function DepositPage() {
  const [tab, setTab] = useState<"manual" | "ivorypay">("ivorypay");

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
            <IvoryPayButton minUsdt={1} />
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
            <RequestForm type="deposit" minUsdt={1} hint="Enter the USDT amount you're depositing." />
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
