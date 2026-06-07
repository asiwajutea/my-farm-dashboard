import type { RequestStatus } from "@/lib/requests.shared";

// Pure status -> badge descriptor mapping (Req 7.3/7.4). Each status maps to a
// distinct label + class set; no two statuses share an indicator (Property 11).

export type BadgeDescriptor = { label: string; className: string };

export function statusBadge(status: RequestStatus): BadgeDescriptor {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
      };
    case "approved":
      return {
        label: "Approved",
        className: "border-primary/30 bg-primary/10 text-primary",
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "border-destructive/30 bg-destructive/10 text-destructive",
      };
  }
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const badge = statusBadge(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
