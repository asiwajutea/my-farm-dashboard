import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar";
import { MerchantTopbar } from "@/components/merchant/MerchantTopbar";

export const Route = createFileRoute("/_merchant")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (!data.user.email_confirmed_at) {
      throw redirect({ to: "/verify-email", search: { email: data.user.email ?? "" } });
    }
    // Check merchant role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "merchant")
      .maybeSingle();
    if (!role) throw redirect({ to: "/merchant/signup" });
    return { user: data.user };
  },
  component: MerchantShell,
});

function MerchantShell() {
  return (
    <div className="flex min-h-screen w-full bg-hero">
      <MerchantSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MerchantTopbar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
