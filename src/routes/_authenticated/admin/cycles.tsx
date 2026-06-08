import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sprout, Loader2, Clock, XCircle } from "lucide-react";

import {
  adminListCycles,
  adminCancelCycle,
  adminForceMatureCycle,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/cycles")({
  head: () => ({ meta: [{ title: "Cycles · Admin" }] }),
  component: AdminCycles,
});

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const STATUSES = ["active", "matured", "reaped", "cancelled", "all"] as const;
type Filter = (typeof STATUSES)[number];

const STATUS_CLASS: Record<string, string> = {
  active: "border-primary/30 bg-primary/10 text-primary",
  matured: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  reaped: "border-border bg-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

function AdminCycles() {
  const listFn = useServerFn(adminListCycles);
  const cancelFn = useServerFn(adminCancelCycle);
  const matureFn = useServerFn(adminForceMatureCycle);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>("active");

  const q = useQuery({
    queryKey: ["admin-cycles", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-cycles"] });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cycle cancelled — principal refunded.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mature = useMutation({
    mutationFn: (id: string) => matureFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cycle matured — farmer can reap now.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const busy = cancel.isPending || mature.isPending;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sprout className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Farming Cycles</h1>
          <p className="text-sm text-muted-foreground">Inspect, force-mature, or cancel cycles.</p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === s
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="glass mt-4 rounded-3xl p-2 sm:p-4">
        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No cycles.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {c.farmer?.display_name ?? c.farmer?.username ?? "Farmer"}
                    <span className="font-mono tabular-nums">{fmt(c.amount)} Seed</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                        STATUS_CLASS[c.status] ?? "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(c.reward_bps / 100).toFixed(2)}% · started {new Date(c.started_at).toLocaleDateString()} · matures{" "}
                    {new Date(c.matures_at).toLocaleString()}
                  </div>
                </div>
                {c.status === "active" && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => mature.mutate(c.id)} disabled={busy}>
                      <Clock className="mr-1 h-4 w-4" /> Force mature
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => cancel.mutate(c.id)} disabled={busy}>
                      <XCircle className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
