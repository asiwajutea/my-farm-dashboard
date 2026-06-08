import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Check,
  Send as SendIcon,
  X,
  ShieldAlert,
  Gavel,
} from "lucide-react";

import {
  getEscrow,
  acceptEscrow,
  releaseEscrow,
  cancelEscrow,
  disputeEscrow,
  resolveEscrow,
} from "@/lib/escrow.functions";
import { useIsAdmin } from "@/hooks/use-admin";
import { EscrowStatusBadge } from "@/components/escrow/EscrowStatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/escrow/$id")({
  head: () => ({ meta: [{ title: "Escrow detail · VFarmers" }] }),
  component: EscrowDetailPage,
});

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function EscrowDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getEscrow);
  const acceptFn = useServerFn(acceptEscrow);
  const releaseFn = useServerFn(releaseEscrow);
  const cancelFn = useServerFn(cancelEscrow);
  const disputeFn = useServerFn(disputeEscrow);
  const resolveFn = useServerFn(resolveEscrow);
  const qc = useQueryClient();
  const { data: adminData } = useIsAdmin();
  const isAdmin = adminData?.isAdmin === true;

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");

  const q = useQuery({ queryKey: ["escrow", id], queryFn: () => getFn({ data: { id } }) });
  const trade = q.data;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["escrow", id] });
    qc.invalidateQueries({ queryKey: ["my-escrows"] });
  };

  const mutation = <T,>(fn: () => Promise<T>, success: string) =>
    ({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(success);
        refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const accept = useMutation(mutation(() => acceptFn({ data: { id } }), "Escrow accepted."));
  const release = useMutation(
    mutation(() => releaseFn({ data: { id } }), "Escrow released — Seeds sent to the counterparty."),
  );
  const cancel = useMutation(
    mutation(() => cancelFn({ data: { id } }), "Escrow cancelled — your Seeds were refunded."),
  );
  const dispute = useMutation({
    mutationFn: () => disputeFn({ data: { id, reason: disputeReason.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Dispute opened. An admin will review it.");
      setDisputeOpen(false);
      setDisputeReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: (releaseToPayee: boolean) =>
      resolveFn({ data: { id, release: releaseToPayee, resolution: resolution.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Dispute resolved.");
      setResolveOpen(false);
      setResolution("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">Escrow not found or you don’t have access.</p>
        <Link to="/escrow" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to escrows
        </Link>
      </div>
    );
  }

  const isPayer = trade.role === "payer";
  const isPayee = trade.role === "payee";
  const counterpartyName =
    trade.counterparty?.display_name ?? trade.counterparty?.username ?? "Farmer";

  const canAccept = isPayee && trade.status === "pending";
  const canRelease = isPayer && (trade.status === "pending" || trade.status === "accepted");
  const canCancel = trade.status === "pending";
  const canDispute = trade.status === "pending" || trade.status === "accepted";
  const canResolve = isAdmin && trade.status === "disputed";

  const anyAction = canAccept || canRelease || canCancel || canDispute || canResolve;
  const busy =
    accept.isPending || release.isPending || cancel.isPending || dispute.isPending || resolve.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <Link to="/escrow" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to escrows
      </Link>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{trade.title ?? "Escrow trade"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPayer ? "You are paying " : "You are receiving from "}
              <span className="font-medium text-foreground">{counterpartyName}</span>
              {trade.counterparty?.username ? ` (@${trade.counterparty.username})` : ""}
            </p>
          </div>
          <EscrowStatusBadge status={trade.status} />
        </div>

        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{fmt(trade.amount)}</span>
          <span className="text-sm text-muted-foreground">Seed</span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Your role</dt>
            <dd className="mt-0.5 font-medium capitalize">{trade.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Created</dt>
            <dd className="mt-0.5">{new Date(trade.created_at).toLocaleString()}</dd>
          </div>
        </dl>

        {trade.terms && (
          <div className="mt-5 rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Terms</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{trade.terms}</p>
          </div>
        )}

        {trade.dispute_reason && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" /> Dispute reason
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{trade.dispute_reason}</p>
          </div>
        )}

        {trade.resolution && (
          <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Admin resolution</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{trade.resolution}</p>
          </div>
        )}
      </div>

      {anyAction && (
        <div className="glass rounded-3xl p-6">
          <h2 className="mb-1 text-lg font-semibold">Actions</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {trade.status === "pending" && isPayer && "Release to send the Seeds, or cancel for a full refund."}
            {trade.status === "pending" && isPayee && "Accept to confirm the terms. You can also dispute."}
            {trade.status === "accepted" && isPayer && "Release the Seeds once the counterparty has delivered."}
            {trade.status === "accepted" && isPayee && "Awaiting the payer to release. Open a dispute if something is wrong."}
            {trade.status === "disputed" && canResolve && "Resolve the dispute: release to the counterparty or refund the payer."}
            {trade.status === "disputed" && !canResolve && "This escrow is under dispute. An admin will resolve it."}
          </p>

          <div className="flex flex-wrap gap-2">
            {canAccept && (
              <Button onClick={() => accept.mutate()} disabled={busy}>
                {accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Accept
              </Button>
            )}
            {canRelease && (
              <Button onClick={() => release.mutate()} disabled={busy}>
                {release.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendIcon className="mr-2 h-4 w-4" />}
                Release funds
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" onClick={() => cancel.mutate()} disabled={busy}>
                {cancel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Cancel & refund
              </Button>
            )}
            {canDispute && (
              <Button variant="outline" onClick={() => setDisputeOpen(true)} disabled={busy}>
                <ShieldAlert className="mr-2 h-4 w-4" />
                Open dispute
              </Button>
            )}
            {canResolve && (
              <Button onClick={() => setResolveOpen(true)} disabled={busy}>
                <Gavel className="mr-2 h-4 w-4" />
                Resolve dispute
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open a dispute</DialogTitle>
            <DialogDescription>
              The Seeds stay locked until an admin reviews and resolves the dispute.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason (optional)</Label>
            <Textarea
              id="dispute-reason"
              maxLength={1000}
              placeholder="Explain what went wrong…"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => dispute.mutate()} disabled={dispute.isPending}>
              {dispute.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
            <DialogDescription>
              Choose where the {fmt(trade.amount)} Seed held in this escrow should go.
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
            <Button
              variant="outline"
              onClick={() => resolve.mutate(false)}
              disabled={resolve.isPending}
            >
              Refund payer
            </Button>
            <Button onClick={() => resolve.mutate(true)} disabled={resolve.isPending}>
              {resolve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Release to counterparty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
