import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { PasscodeGate } from "@/components/passcode/PasscodeGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // If the URL contains Supabase hash tokens (e.g. user landed here via an
    // old confirmation email pointing to /dashboard instead of /auth/callback),
    // hand off to the dedicated callback page which waits for the SDK to
    // exchange the tokens before checking the session.
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      throw redirect({ to: "/auth/callback" });
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // Block access to the app until email is confirmed
    if (!data.user.email_confirmed_at) {
      throw redirect({
        to: "/verify-email",
        search: { email: data.user.email ?? "" },
      });
    }
    return { user: data.user };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-hero">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1">
            <MaintenanceGate>
              <Outlet />
            </MaintenanceGate>
          </main>
        </div>
      </div>
      <PasscodeGate />
    </SidebarProvider>
  );
}
