import type { EscrowStatus } from "@/lib/escrow.functions";

type Descriptor = { label: string; className: string };

const MAP: Record<EscrowStatus, Descriptor> = {
  pending: { label: "Pending", className: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
  accepted: { label: "Accepted", className: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  released: { label: "Released", className: "border-primary/30 bg-primary/10 text-primary" },
  cancelled: { label: "Cancelled", className: "border-border bg-muted text-muted-foreground" },
  disputed: { label: "Disputed", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  refunded: { label: "Refunded", className: "border-border bg-muted text-muted-foreground" },
};

export function escrowStatusBadge(status: EscrowStatus): Descriptor {
  return MAP[status];
}

export function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  const b = escrowStatusBadge(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.className}`}
    >
      {b.label}
    </span>
  );
}
