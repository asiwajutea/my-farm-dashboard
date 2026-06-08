import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";

import { adminListAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log · Admin" }] }),
  component: AdminAudit,
});

const ACTION_LABEL: Record<string, string> = {
  request_approved: "Approved request",
  request_rejected: "Rejected request",
  balance_adjusted: "Adjusted balance",
  farmer_frozen: "Froze farmer",
  farmer_unfrozen: "Unfroze farmer",
  cycle_cancelled: "Cancelled cycle",
  cycle_matured: "Force-matured cycle",
  coupon_created: "Created coupon",
  coupon_enabled: "Enabled coupon",
  coupon_disabled: "Disabled coupon",
  escrow_released: "Released escrow",
  escrow_refunded: "Refunded escrow",
};

function summarize(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const d = detail as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.amount === "number" || typeof d.amount === "string") parts.push(`amount ${d.amount}`);
  if (typeof d.code === "string") parts.push(`code ${d.code}`);
  if (typeof d.note === "string" && d.note) parts.push(`“${d.note}”`);
  if (typeof d.memo === "string" && d.memo) parts.push(`“${d.memo}”`);
  if (typeof d.resolution === "string" && d.resolution) parts.push(`“${d.resolution}”`);
  return parts.join(" · ");
}

function AdminAudit() {
  const listFn = useServerFn(adminListAuditLog);
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => listFn() });
  const rows = q.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Every admin action, newest first.</p>
        </div>
      </header>

      <div className="glass mt-6 rounded-3xl p-2 sm:p-4">
        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No admin actions logged yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((r) => {
              const summary = summarize(r.detail);
              return (
                <li key={r.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{ACTION_LABEL[r.action] ?? r.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.target_type ? `${r.target_type}` : ""}
                      {summary ? ` · ${summary}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>{r.actor?.display_name ?? r.actor?.username ?? "Admin"}</div>
                    <div>{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
