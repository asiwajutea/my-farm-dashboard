import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpFromLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequestForm, useSeedRate } from "@/components/wallet/RequestForm";
import { RequestsHistory } from "@/components/wallet/RequestsHistory";
import { fmtAmount } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({ meta: [{ title: "Withdraw · VFarmers" }] }),
  component: WithdrawPage,
});

function useAvailableBalance() {
  return useQuery({
    queryKey: ["primary-wallet"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { available: 0 };
      const { data } = await supabase
        .from("wallets")
        .select("balance, locked")
        .eq("user_id", user.id)
        .eq("kind", "primary")
        .maybeSingle();
      const available = Number(data?.balance ?? 0) - Number(data?.locked ?? 0);
      return { available };
    },
  });
}

function WithdrawPage() {
  const { data } = useAvailableBalance();
  const { data: rate = 1 } = useSeedRate();
  const availableSeed = data?.available ?? 0;
  const availableUsdt = availableSeed * rate;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ArrowUpFromLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Withdraw USDT</h1>
          <p className="text-sm text-muted-foreground">
            Withdraw in USDT. The equivalent in Seeds is deducted from your Primary wallet after
            approval.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New withdrawal</CardTitle>
          <CardDescription>
            Available balance:{" "}
            <span className="font-mono tabular-nums text-foreground">{fmtAmount(availableUsdt)}</span>{" "}
            USDT
            <span className="text-muted-foreground">
              {" "}
              (≈ {fmtAmount(availableSeed)} Seed)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm
            type="withdrawal"
            minUsdt={1}
            availableSeed={availableSeed}
            hint="Withdrawals are reviewed by the admin team."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestsHistory filter="withdrawal" />
        </CardContent>
      </Card>
    </div>
  );
}
