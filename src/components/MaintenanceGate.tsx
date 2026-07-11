import { useRouterState } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { useSiteState } from "@/hooks/use-site-state";
import { useIsAdmin, useHasPrivilege } from "@/hooks/use-admin";

// Maps the first path segment to the maintenance page-key the admin toggles.
// Keep in sync with PAGE_KEYS in the admin maintenance page.
const PATH_TO_KEY: Record<string, string> = {
  dashboard: "dashboard",
  wallet: "wallet",
  deposit: "deposit",
  withdraw: "withdraw",
  send: "send",
  farm: "farm",
  affiliate: "affiliate",
  escrow: "escrow",
  coupons: "coupons",
  notifications: "notifications",
  profile: "profile",
  verify: "verify",
  upgrade: "upgrade",
};

function pageKeyFor(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return null;
  return PATH_TO_KEY[seg] ?? null;
}

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: state } = useSiteState();
  const { data: adminData } = useIsAdmin();
  const canBypass = useHasPrivilege("bypass_maintenance");
  const isAdmin = adminData?.isAdmin === true;

  // Admin console always bypasses; admins and privileged users always bypass.
  if (isAdmin || canBypass) return <>{children}</>;
  if (pathname.startsWith("/admin")) return <>{children}</>;
  if (!state) return <>{children}</>;

  const key = pageKeyFor(pathname);
  const pageBlocked = key ? !!state.pages[key] : false;
  if (!state.global && !pageBlocked) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-3xl border border-border bg-card/60 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Wrench className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          {state.global ? "Site under maintenance" : "Page under maintenance"}
        </h1>
        <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
          {state.message || "We'll be back shortly."}
        </p>
      </div>
    </div>
  );
}
