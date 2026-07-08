import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

/**
 * Shown when a new service worker is waiting to activate.
 * User can click "Refresh" to load the latest version immediately,
 * or dismiss it — the update will apply automatically on next page load.
 */
export function UpdateBanner({ onUpdate }: { onUpdate: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-3 shadow-elegant backdrop-blur-md sm:bottom-6"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <RefreshCw className="h-3.5 w-3.5" />
      </div>
      <p className="text-sm text-foreground">
        A new version of VFarmers is available.
      </p>
      <button
        type="button"
        onClick={onUpdate}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notification"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
