import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Coins, TrendingUp } from "lucide-react";
import { useState } from "react";
import { getMyAffiliateSummary, getMyDownlines } from "@/lib/affiliate.functions";
import { ShareLink } from "@/components/affiliate/ShareLink";
import { Skeleton } from "@/components/ui/skeleton";
import { Loadable } from "@/components/ui/loadable";
import { SimpleRowsSkeleton } from "@/components/skeletons/ListSkeleton";

export const Route = createFileRoute("/_authenticated/affiliate")({
  head: () => ({ meta: [{ title: "Affiliate · VFarmers" }] }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const sumFn = useServerFn(getMyAffiliateSummary);
  const dlFn = useServerFn(getMyDownlines);

  const summary = useQuery({ queryKey: ["aff-sum"], queryFn: () => sumFn() });
  const downlines = useQuery({ queryKey: ["aff-dl"], queryFn: () => dlFn() });

  const [genTab, setGenTab] = useState<1 | 2 | 3>(1);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Affiliate</h1>
        <p className="text-sm text-muted-foreground">Earn from 3 generations of farmers you bring to VFarmers.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Coins} label="Total earned" loading={summary.isLoading} value={summary.data ? summary.data.totalEarned.toFixed(2) + " Seed" : "—"} />
        <Stat icon={TrendingUp} label="This month" loading={summary.isLoading} value={summary.data ? summary.data.monthEarned.toFixed(2) + " Seed" : "—"} />
        <Stat icon={Users} label="Direct (Gen 1)" loading={summary.isLoading} value={summary.data ? String(summary.data.gen1Count) : "—"} />
        <Stat
          icon={Users}
          label="Network (Gen 2 + 3)"
          loading={summary.isLoading}
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
          <Loadable loading={downlines.isLoading} skeleton={<SimpleRowsSkeleton rows={3} />}>
            {downlines.data?.filter((d) => d.generation === genTab).length === 0 ? (
              <p className="text-xs text-muted-foreground">No farmers in this generation yet.</p>
            ) : (
              downlines.data
                ?.filter((d) => d.generation === genTab)
                .map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                    <span>{d.display_name || d.username || "Farmer"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                ))
            )}
          </Loadable>
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

function Stat({ icon: Icon, label, value, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <div className="animate-fade-in mt-1 text-xl font-semibold">{value}</div>
      )}
    </div>
  );
}
