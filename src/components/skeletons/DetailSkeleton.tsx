import { Skeleton, SkeletonText, SkeletonCircle } from "@/components/ui/skeleton";

/**
 * Placeholder for a single-record detail card: a heading row, a large headline
 * value, and a two-column meta grid. Used for the escrow detail and admin
 * farmer detail screens.
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="glass rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <SkeletonText className="w-64" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        <Skeleton className="mt-5 h-10 w-40" />

        <div className="mt-5 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonText className="h-3 w-20" />
              <SkeletonText className="w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Profile-style header skeleton: a square/large avatar with stacked identity
 * lines beside it, then a row of chips.
 */
export function ProfileHeaderSkeleton() {
  return (
    <div className="glass rounded-3xl p-7" aria-hidden="true">
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <Skeleton className="h-24 w-24 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <SkeletonText className="mx-auto h-5 w-40 sm:mx-0" />
          <SkeletonText className="mx-auto h-3 w-52 sm:mx-0" />
          <Skeleton className="mx-auto mt-3 h-6 w-32 rounded-full sm:mx-0" />
        </div>
        <SkeletonCircle className="hidden h-14 w-40 rounded-2xl sm:block" />
      </div>
    </div>
  );
}
