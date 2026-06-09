import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Check, X, FileText, Image as ImageIcon } from "lucide-react";

import {
  adminListKyc,
  adminReviewKyc,
  adminGetKycFileUrl,
  type AdminKycRow,
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

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  head: () => ({ meta: [{ title: "KYC · Admin" }] }),
  component: AdminKyc,
});

const STATUSES = ["pending", "verified", "rejected", "all"] as const;
type Filter = (typeof STATUSES)[number];

const DOC_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_license: "Driver's license",
};

const STATUS_CLS: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  verified: "border-primary/30 bg-primary/10 text-primary",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  unverified: "border-border bg-muted/40 text-muted-foreground",
};

function AdminKyc() {
  const listFn = useServerFn(adminListKyc);
  const reviewFn = useServerFn(adminReviewKyc);
  const fileFn = useServerFn(adminGetKycFileUrl);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>("pending");
  const [target, setTarget] = useState<AdminKycRow | null>(null);
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["admin-kyc", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });

  const review = useMutation({
    mutationFn: () =>
      reviewFn({ data: { id: target!.id, approve, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success(approve ? "Identity verified." : "Submission rejected.");
      setTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewFile = useMutation({
    mutationFn: (path: string) => fileFn({ data: { path } }),
    onSuccess: (r) => {
      if (r.url) window.open(r.url, "_blank", "noopener");
      else toast.error("Couldn't load file.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Identity verification</h1>
          <p className="text-sm text-muted-foreground">
            Review submitted documents and approve or reject KYC.
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
        <Loadable loading={q.isLoading} skeleton={<div className="p-1"><ListSkeleton rows={4} leading="none" /></div>}>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No {filter === "all" ? "" : filter} submissions.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.full_name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({r.farmer?.username ? `@${r.farmer.username}` : r.farmer?.display_name ?? "farmer"})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {DOC_LABELS[r.document_type] ?? r.document_type} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_CLS[r.status] ?? STATUS_CLS.unverified
                    }`}
                  >
                    {r.status}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => viewFile.mutate(r.document_path)}
                    disabled={viewFile.isPending}
                    title="View document"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => viewFile.mutate(r.selfie_path)}
                    disabled={viewFile.isPending}
                    title="View selfie"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
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
            <DialogTitle>{approve ? "Approve" : "Reject"} verification</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  {approve
                    ? `Mark ${target.full_name} as a verified Farmer.`
                    : `Reject ${target.full_name}'s submission. They can submit again.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kyc-note">Note {approve ? "(optional)" : "(shown to the Farmer)"}</Label>
            <Textarea
              id="kyc-note"
              maxLength={1000}
              placeholder={approve ? "Visible in the audit log." : "Explain why, e.g. blurry document."}
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
