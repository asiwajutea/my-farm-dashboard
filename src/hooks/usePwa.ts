import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Registers the service worker, tracks online/offline state, captures the
 * browser's install prompt, and detects when a new service worker is waiting
 * so we can prompt the user to refresh for the latest version.
 */
export function usePwa() {
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    // ── Service worker registration ──────────────────────────────────────
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // A new SW installed while the page is open → offer a refresh
          const checkForWaiting = () => {
            if (registration.waiting) {
              setWaitingSW(registration.waiting);
              setUpdateAvailable(true);
            }
          };

          checkForWaiting();

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingSW(newWorker);
                setUpdateAvailable(true);
              }
            });
          });

          // Poll for updates every 60 seconds (catches deploys on long-lived tabs)
          const intervalId = setInterval(() => registration.update(), 60_000);
          return () => clearInterval(intervalId);
        })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    }

    // ── Install prompt ────────────────────────────────────────────────────
    const alreadyInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (alreadyInstalled) setIsInstalled(true);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  const dismissInstall = () => {
    setInstallDismissed(true);
    setInstallPrompt(null);
  };

  /** Tell the waiting SW to take over, then reload to pick up new assets. */
  const applyUpdate = () => {
    // Always set up the reload handler first, regardless of current controller state.
    // The controllerchange event fires when the new SW takes over.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    }, { once: true });

    if (waitingSW) {
      // Tell the waiting SW to skip waiting and become active immediately
      waitingSW.postMessage({ type: "SKIP_WAITING" });
    } else {
      // No waiting SW reference in state — check the registration directly
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        } else {
          // Nothing waiting — just reload; the browser will use whatever is cached
          window.location.reload();
        }
      });
    }

    // Hard safety net: reload after 4 s in case controllerchange never fires
    // (e.g. no SW was registered, or the event already fired)
    setTimeout(() => window.location.reload(), 4000);
  };

  const showInstallPrompt = !!installPrompt && !isInstalled && !installDismissed;

  return {
    isOnline,
    showInstallPrompt,
    triggerInstall,
    dismissInstall,
    isInstalled,
    updateAvailable,
    applyUpdate,
  };
}
