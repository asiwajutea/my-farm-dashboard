import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

import { getMyMaintenanceFees, payMaintenanceFee } from "@/lib/affiliate.functions";
import { useSeedRate } from "@/components/wallet/RequestForm";
import { seedToUsdt, fmtAmount } from "@/lib/currency";

/**
 * Monthly maintenance fee panel: shows the current due/overdue fee with a pay
 * action plus a short payment history. Self-contained (fetches its own data via
 * react-query) so it can be dropped onto any page. Amounts are shown in Seed
 * with a USDT equivalent for the farmer.
 */
export function MaintenanceCard({ className }: { className?: string }) {
  const feesFn = useServerFn(getMyMaintenanceFees);
  const payFn = useServerFn(payMaintenanceFee);
  const { data: rate = 1 } = useSeedRate();

  const fees = useQuery({ queryKey: ["aff-fees"], queryFn: () => feesFn() });
  const [paying, setPaying] = useState<string | null>(null);

  const handlePay = async (id: string) => {
    setPaying(id);
    try {
      await payFn({ data: { feeId: id } });
      toast.success("Maintenance fee paid");
      fees.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPaying(null);
    }
  };

  const dueFee = fees.data?.find((f) => f.status === "due" || f.status === "overdue");

  return (
    <div className={`rounded-2xl border border-border bg-card/40 p-5 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Monthly maintenance</h3>
      </div>
      {dueFee ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
          <div>
            <div className="text-sm font-medium">
              {fmtAmount(Number(dueFee.amount))} Seed ·{" "}
              {new Date(dueFee.period_start).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              ≈ {fmtAmount(seedToUsdt(Number(dueFee.amount), rate))} USDT · Status: {dueFee.status}
            </div>
          </div>
          <button
            onClick={() => handlePay(dueFee.id)}
            disabled={paying === dueFee.id}
            className="rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {paying === dueFee.id ? "Paying…" : "Pay fee"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No fee due. You're all caught up.</p>
      )}
      <div className="mt-3 space-y-1.5">
        {fees.data?.slice(0, 6).map((f) => (
          <div key={f.id} className="flex items-center justify-between text-xs">
            <span>
              {new Date(f.period_start).toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="text-muted-foreground">
              {fmtAmount(Number(f.amount))} Seed (≈ {fmtAmount(seedToUsdt(Number(f.amount), rate))} USDT) · {f.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
