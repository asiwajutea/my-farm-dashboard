import { Skeleton, SkeletonText, SkeletonCircle } from "@/components/ui/skeleton";

/**
 * Generic divided list placeholder: each row has an optional leading
 * circle/icon, two stacked text lines, and a trailing value — mirroring the
 * `<ul class="divide-y"><li>` rows used across the app (wallet ledger, escrow
 * list, redemptions, admin lists).
 */
export function ListSkeleton({
  rows = 4,
  leading = "circle",
  trailing = true,
}: {
  rows?: number;
  leading?: "circle" | "none";
  trailing?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/40" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {leading === "circle" && <SkeletonCircle className="h-9 w-9 shrink-0" />}
            <div className="min-w-0 space-y-2">
              <SkeletonText className="w-32" />
              <SkeletonText className="h-3 w-24" />
            </div>
          </div>
          {trailing && (
            <div className="flex flex-col items-end gap-2">
              <SkeletonText className="w-16" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Compact two-line rows without a trailing value (e.g. affiliate downlines). */
export function SimpleRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2.5"
        >
          <SkeletonText className="w-28" />
          <SkeletonText className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
