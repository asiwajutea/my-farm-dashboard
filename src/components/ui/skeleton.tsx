import { cn } from "@/lib/utils";

/**
 * Base skeleton block with a continuous left-to-right shimmer (see the
 * `skeleton` utility in styles.css). Compose these into structure-specific
 * placeholders that mirror the real content's layout to avoid layout shift.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />;
}

/** A single text line. Width is controllable via className (e.g. "w-2/3"). */
function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3.5 rounded", className)} />;
}

/** A circular placeholder for avatars/icons. */
function SkeletonCircle({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-full", className)} />;
}

/**
 * A paragraph block of varied-width lines mimicking real text. `lines` controls
 * how many bars render; the last line is shorter for a natural look.
 */
function SkeletonParagraph({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-3/4", "w-5/6", "w-2/3"];
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonText key={i} className={i === lines - 1 ? "w-1/2" : widths[i % widths.length]} />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCircle, SkeletonParagraph };
