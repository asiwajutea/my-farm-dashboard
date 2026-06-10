import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Inbox, Loader2, Check, X, FileText, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import {
  adminListRequests,
  adminReviewRequest,
  adminGetProofUrl,
  type AdminRequestRow,
} from "@/lib/admin.functions";
import { StatusBadge } from "@/components/wallet/StatusBadge";
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

export const Route = createFileRoute("/_authenticated/admin/requests")({
  head: () => ({ meta: [{ title: "Requests · Admin" }] }),
  component: AdminRequests,
});

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUSES = ["pending", "approved", "rejected", "all"] as const;
type Filter = (typeof STATUSES)[number];

function AdminRequests() {
  const listFn = useServerFn(adminListRequests);
  const reviewFn = useServerFn(adminReviewRequest);
  const proofFn = useServerFn(adminGetProofUrl);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>("pending");
  const [target, setTarget] = useState<AdminRequestRow | null>(null);
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["admin-requests", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });

  const review = useMutation({
    mutationFn: () =>
      reviewFn({ data: { type: target!.type, id: target!.id, approve, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success(approve ? "Request approved." : "Request rejected.");
      setTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewProof = useMutation({
    mutationFn: (path: string) => proofFn({ data: { path } }),
    onSuccess: (r) => {
      if (r.url) window.open(r.url, "_blank", "noopener");
      else toast.error("Couldn't load proof.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Inbox className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deposits & Withdrawals</h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject requests — money moves through the atomic ledger.
          </p>
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
        <Loadable loading={q.isLoading} skeleton={<div className="p-1"><ListSkeleton rows={5} /></div>}>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No {filter === "all" ? "" : filter} requests.</p>
          ) : (
            <ul className="divide-y divide-border/40">
            {rows.map((r) => (
              <li key={`${r.type}-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      r.type === "deposit" ? "bg-primary/15 text-primary" : "bg-gold/15 text-gold"
                    }`}
                  >
                    {r.type === "deposit" ? (
                      <ArrowDownToLine className="h-4 w-4" />
                    ) : (
                      <ArrowUpFromLine className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {r.farmer?.display_name ?? r.farmer?.username ?? "Farmer"}
                      <span className="ml-2 font-mono tabular-nums">
                        {r.type === "withdrawal" && r.amount_usdt != null
                          ? `${fmt(r.amount_usdt)} USDT`
                          : `${fmt(r.amount)} Seed`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="capitalize">{r.type}</span> · {r.method} ·{" "}
                      {r.type === "withdrawal" && r.amount_usdt != null && (
                        <>{fmt(r.amount)} Seed · </>
                      )}
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.proof_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => viewProof.mutate(r.proof_url!)}
                      disabled={viewProof.isPending}
                      title="View proof"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setTarget(r);
                          setApprove(true);
                          setNote("");
                        }}
                      >
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTarget(r);
                          setApprove(false);
                          setNote("");
                        }}
                      >
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          )}
        </Loadable>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{approve ? "Approve" : "Reject"} request</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  {approve ? "This will " : "This will not "}
                  move {fmt(target.amount)} Seed
                  {approve && target.type === "deposit" && " into the farmer's primary wallet."}
                  {approve && target.type === "withdrawal" && " out of the farmer's primary wallet."}
                  {!approve && " — the request is marked rejected."}
                  {target.type === "withdrawal" && target.amount_usdt != null && (
                    <>
                      {" "}
                      The locked payout is{" "}
                      <span className="font-mono tabular-nums">
                        {fmt(target.amount_usdt)} USDT
                      </span>
                      .
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              maxLength={1000}
              placeholder="Visible in the audit log and on the request."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => review.mutate()} disabled={review.isPending}>
              {review.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {approve ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
