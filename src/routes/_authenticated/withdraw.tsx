import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpFromLine, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RequestForm, useSeedRate } from "@/components/wallet/RequestForm";
import { RequestsHistory } from "@/components/wallet/RequestsHistory";
import {
  WithdrawalLockCard,
  PayoutScheduleHint,
  fmtDate,
} from "@/components/wallet/WithdrawalLockNotice";
import { usePayoutLock } from "@/hooks/use-payout-lock";
import { fmtAmount } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getPremiumStatus } from "@/lib/premium.functions";

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
      // Primary wallet is now USDT-denominated
      const available = Number(data?.balance ?? 0) - Number(data?.locked ?? 0);
      return { available };
    },
  });
}

/** Fetch withdrawal_fee_standard_pct directly from app_settings (public config). */
function useStandardFeePct() {
  return useQuery({
    queryKey: ["withdrawal-fee-standard-pct"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("withdrawal_fee_standard_pct")
        .eq("id", true)
        .maybeSingle();
      return data?.withdrawal_fee_standard_pct != null
        ? Number(data.withdrawal_fee_standard_pct)
        : 5; // default from migration
    },
    staleTime: 30_000,
  });
}

function WithdrawPage() {
  const { data } = useAvailableBalance();
  const { data: rate = 1 } = useSeedRate();
  const { data: lock } = usePayoutLock();
  // Primary wallet is USDT — no conversion needed
  const availableUsdt = data?.available ?? 0;
  const availableSeedDisplay = rate > 0 ? availableUsdt / rate : 0;
  const locked = lock?.locked ?? false;

  const getPremiumStatusFn = useServerFn(getPremiumStatus);
  const { data: premiumStatus } = useQuery({
    queryKey: ["premium-status"],
    queryFn: () => getPremiumStatusFn(),
    staleTime: 30_000,
  });
  const { data: standardFeePct = 5 } = useStandardFeePct();

  // Determine whether the user has active premium
  const isPremiumActive =
    !!premiumStatus &&
    premiumStatus.tier !== "standard" &&
    premiumStatus.days_left > 0;

  // Pick the applicable fee percentage (Requirements 8.4–8.7)
  const feePct = isPremiumActive
    ? (premiumStatus?.benefits.withdrawal_fee_premium_pct ?? 0)
    : standardFeePct;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
        </div>
        {lock?.enabled && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Next payout
              </div>
              <div className="text-sm font-medium">{fmtDate(lock.nextPayoutDate)}</div>
            </div>
          </div>
        )}
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
              (≈ {fmtAmount(availableSeedDisplay)} Seed)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locked && lock ? (
            <WithdrawalLockCard state={lock} />
          ) : (
            <div className="space-y-4">
              <RequestForm
                type="withdrawal"
                minUsdt={1}
                availableUsdt={availableUsdt}
                hint="Withdrawals are reviewed by the admin team."
                feePct={feePct}
              />
              {lock && <PayoutScheduleHint state={lock} />}
            </div>
          )}
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
