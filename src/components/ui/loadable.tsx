import type { ReactNode } from "react";

/**
 * Crossfades between a skeleton placeholder and the real content.
 *
 * While `loading` is true it renders `skeleton`. Once loading finishes the
 * content is rendered wrapped in a fade-in animation, so the transition reads
 * as a smooth reveal rather than a sudden swap. Because each branch occupies
 * the same layout region (the skeletons are built to match the content's
 * shape), there is no layout shift.
 */
export function Loadable({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  if (loading) return <>{skeleton}</>;
  return <div className="animate-fade-in">{children}</div>;
}
