import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Handshake, Loader2, ShieldAlert } from "lucide-react";

import {
  adminListEscrowDisputes,
  adminResolveEscrow,
  type AdminEscrowDispute,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loadable } from "@/components/ui/loadable";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/escrow")({
  head: () => ({ meta: [{ title: "Escrow disputes · Admin" }] }),
  component: AdminEscrow,
});

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const name = (f: AdminEscrowDispute["payer"]) => f?.display_name ?? f?.username ?? "Farmer";

function AdminEscrow() {
  const listFn = useServerFn(adminListEscrowDisputes);
  const resolveFn = useServerFn(adminResolveEscrow);
  const qc = useQueryClient();

  const [target, setTarget] = useState<AdminEscrowDispute | null>(null);
  const [resolution, setResolution] = useState("");

  const q = useQuery({ queryKey: ["admin-escrow-disputes"], queryFn: () => listFn() });

  const resolve = useMutation({
    mutationFn: (release: boolean) =>
      resolveFn({ data: { id: target!.id, release, resolution: resolution.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Dispute resolved.");
      setTarget(null);
      setResolution("");
      qc.invalidateQueries({ queryKey: ["admin-escrow-disputes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Handshake className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escrow Disputes</h1>
          <p className="text-sm text-muted-foreground">Release held funds to the payee, or refund the payer.</p>
        </div>
      </header>

      <div className="glass mt-6 rounded-3xl p-2 sm:p-4">
        <Loadable loading={q.isLoading} skeleton={<div className="p-1"><ListSkeleton rows={3} leading="none" /></div>}>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No open disputes.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {rows.map((d) => (
                <li key={d.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {d.title ?? "Escrow trade"} · <span className="font-mono tabular-nums">{fmt(d.amount)} Seed</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Payer <span className="text-foreground">{name(d.payer)}</span> → Payee{" "}
                        <span className="text-foreground">{name(d.payee)}</span> ·{" "}
                        {new Date(d.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => { setTarget(d); setResolution(""); }}>
                      Resolve
                    </Button>
                  </div>
                  {d.dispute_reason && (
                    <div className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span className="whitespace-pre-wrap">{d.dispute_reason}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Loadable>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  Decide where the {fmt(target.amount)} Seed held in this escrow should go: release to{" "}
                  {name(target.payee)} (payee) or refund {name(target.payer)} (payer).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution note (optional)</Label>
            <Textarea
              id="resolution"
              maxLength={1000}
              placeholder="Reason for the decision…"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => resolve.mutate(false)} disabled={resolve.isPending}>
              Refund payer
            </Button>
            <Button onClick={() => resolve.mutate(true)} disabled={resolve.isPending}>
              {resolve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Release to payee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
