import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

/**
 * Shown when a new service worker is waiting to activate.
 * Clicking "Refresh" posts SKIP_WAITING to the SW then reloads the page.
 */
export function UpdateBanner({ onUpdate }: { onUpdate: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading]     = useState(false);

  if (dismissed) return null;

  const handleUpdate = () => {
    setLoading(true);
    onUpdate();
    // Loading stays true — the page reloads within 4 s (safety net in applyUpdate)
    // so there's no need to reset it.
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl border border-primary/30 bg-card/95 shadow-elegant backdrop-blur-md sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-max sm:max-w-sm sm:-translate-x-1/2"
    >
      {/* Single row — never wraps on any screen size */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        {/* Icon */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </div>

        {/* Text */}
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground sm:text-sm">
          New version available
        </p>

        {/* Refresh button */}
        <button
          type="button"
          onClick={handleUpdate}
          disabled={loading}
          className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-70 sm:px-3 sm:text-xs"
        >
          {loading ? "Updating…" : "Refresh"}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={loading}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
