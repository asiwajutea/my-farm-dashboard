import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { usePwa } from "@/hooks/usePwa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VFarmers" },
      { name: "description", content: "VFarmers is a digital farming ecosystem where users farm virtual Seed for community rewards." },
      { name: "author", content: "VFarmers" },
      // PWA
      { name: "application-name", content: "VFarmers" },
      { name: "apple-mobile-web-app-title", content: "VFarmers" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#22c55e" },
      // OG / Twitter
      { property: "og:title", content: "VFarmers — Sow Seeds, Reap Rewards" },
      { property: "og:description", content: "VFarmers is a transparent, community-driven ecosystem where every member is a Farmer. Cultivate Seeds, harvest cycles, and trade peer-to-peer — all in one place." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://vfarmers.app" },
      { property: "og:image", content: "https://vfarmers.app/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "VFarmers — Community Farming Ecosystem" },
      { property: "og:site_name", content: "VFarmers" },
      // Twitter / X
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VFarmers — Sow Seeds, Reap Rewards" },
      { name: "twitter:description", content: "VFarmers is a transparent, community-driven ecosystem where every member is a Farmer. Cultivate Seeds, harvest cycles, and trade peer-to-peer — all in one place." },
      { name: "twitter:image", content: "https://vfarmers.app/og-image.png" },
      { name: "twitter:image:alt", content: "VFarmers — Community Farming Ecosystem" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { isOnline, showInstallPrompt, triggerInstall, dismissInstall } = usePwa();

  return (
    <QueryClientProvider client={queryClient}>
      {!isOnline && <OfflineBanner />}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* Floating notifications anchored to the bottom-right of the viewport. */}
      <Toaster position="bottom-right" richColors closeButton />
      {/* PWA install prompt — shown at bottom, non-intrusive */}
      {showInstallPrompt && (
        <InstallPrompt onInstall={triggerInstall} onDismiss={dismissInstall} />
      )}
    </QueryClientProvider>
  );
}
