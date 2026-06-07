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
          <h1 className="text-xl font-semibold">Deposit Seeds</h1>
          <p className="text-sm text-muted-foreground">
            Submit a deposit request. Seeds credit to your Primary wallet once approved.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New deposit</CardTitle>
          <CardDescription>Attach a payment screenshot or receipt to speed up review.</CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm type="deposit" minAmount={0.01} hint="Minimum 0.01 Seeds." />
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
