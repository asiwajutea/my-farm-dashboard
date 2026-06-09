import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine } from "lucide-react";
import { RequestForm } from "@/components/wallet/RequestForm";
import { RequestsHistory } from "@/components/wallet/RequestsHistory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({ meta: [{ title: "Deposit · VFarmers" }] }),
  component: DepositPage,
});

function DepositPage() {
  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ArrowDownToLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Deposit USDT</h1>
          <p className="text-sm text-muted-foreground">
            Pay in USDT to buy Seeds. The equivalent credits to your Primary wallet once approved.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New deposit</CardTitle>
          <CardDescription>
            Enter the amount in USDT — you'll see the Seed equivalent before submitting. Attach a
            payment screenshot or receipt to speed up review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm type="deposit" minUsdt={1} hint="Enter the USDT amount you're depositing." />
        </CardContent>
      </Card>

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
