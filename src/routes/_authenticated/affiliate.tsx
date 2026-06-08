import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Coins, TrendingUp, Wrench, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMyAffiliateSummary,
  getMyDownlines,
  getMyMaintenanceFees,
  payMaintenanceFee,
} from "@/lib/affiliate.functions";
import { ShareLink } from "@/components/affiliate/ShareLink";

export const Route = createFileRoute("/_authenticated/affiliate")({
  head: () => ({ meta: [{ title: "Affiliate · VFarmers" }] }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const sumFn = useServerFn(getMyAffiliateSummary);
  const dlFn = useServerFn(getMyDownlines);
  const feesFn = useServerFn(getMyMaintenanceFees);
  const payFn = useServerFn(payMaintenanceFee);

  const summary = useQuery({ queryKey: ["aff-sum"], queryFn: () => sumFn() });
  const downlines = useQuery({ queryKey: ["aff-dl"], queryFn: () => dlFn() });
  const fees = useQuery({ queryKey: ["aff-fees"], queryFn: () => feesFn() });

  const [genTab, setGenTab] = useState<1 | 2 | 3>(1);
  const [paying, setPaying] = useState<string | null>(null);

  const handlePay = async (id: string) => {
    setPaying(id);
    try {
      await payFn({ data: { feeId: id } });
      toast.success("Maintenance fee paid");
      fees.refetch();
      summary.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPaying(null);
    }
  };

  const dueFee = fees.data?.find((f) => f.status === "due" || f.status === "overdue");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Affiliate</h1>
        <p className="text-sm text-muted-foreground">Earn from 3 generations of farmers you bring to VFarmers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Coins} label="Total earned" value={summary.data ? summary.data.totalEarned.toFixed(2) + " Seed" : "—"} />
        <Stat icon={TrendingUp} label="This month" value={summary.data ? summary.data.monthEarned.toFixed(2) + " Seed" : "—"} />
        <Stat icon={Users} label="Direct (Gen 1)" value={summary.data ? String(summary.data.gen1Count) : "—"} />
        <Stat
          icon={Users}
          label="Network (Gen 2 + 3)"
          value={summary.data ? String(summary.data.gen2Count + summary.data.gen3Count) : "—"}
        />
      </div>

      {summary.data?.referralCode && <ShareLink code={summary.data.referralCode} />}

      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your downlines</h3>
          <div className="flex gap-1 rounded-lg border border-border bg-background/60 p-0.5 text-xs">
            {[1, 2, 3].map((g) => (
              <button
                key={g}
                onClick={() => setGenTab(g as 1 | 2 | 3)}
                className={`rounded-md px-3 py-1 ${
                  genTab === g ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Gen {g}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {downlines.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {downlines.data?.filter((d) => d.generation === genTab).length === 0 && (
            <p className="text-xs text-muted-foreground">No farmers in this generation yet.</p>
          )}
          {downlines.data
            ?.filter((d) => d.generation === genTab)
            .map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                <span>{d.display_name || d.username || "Farmer"}</span>
                <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Monthly maintenance</h3>
        </div>
        {dueFee ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
            <div>
              <div className="text-sm font-medium">
                {dueFee.amount} Seed · {new Date(dueFee.period_start).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </div>
              <div className="text-xs text-muted-foreground">Status: {dueFee.status}</div>
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
              <span>{new Date(f.period_start).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
              <span className="text-muted-foreground">{f.amount} Seed · {f.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold">Recent commissions</h3>
        <div className="mt-3 space-y-1.5">
          {summary.data?.recent.length === 0 && (
            <p className="text-xs text-muted-foreground">No commissions yet.</p>
          )}
          {summary.data?.recent.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
              <span>
                Gen {c.generation} · {c.source}
              </span>
              <span className="font-medium text-primary">+{c.amount.toFixed(4)} Seed</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
