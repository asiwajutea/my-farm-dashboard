import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Admin-page privileges — maps each admin path segment to the privilege
// code that grants access without full admin role.
const PAGE_PRIVILEGE: Record<string, string> = {
  "farmers":          "admin_farmers",
  "requests":         "admin_requests",
  "kyc":              "admin_kyc",
  "cycles":           "admin_cycles",
  "escrow":           "admin_escrow",
  "coupons":          "admin_coupons",
  "pv":               "admin_pv",
  "audit":            "admin_audit",
  "deposit-channels": "admin_deposit_channels",
};

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    // Full admins pass unconditionally
    const { data: isAdmin } = await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }>;
    }).rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (isAdmin === true) return;

    // Non-admins: check if they have a privilege for the specific page being accessed
    const pathSegment = location.pathname.replace(/^\/admin\/?/, "").split("/")[0];

    if (pathSegment && PAGE_PRIVILEGE[pathSegment]) {
      const requiredPrivilege = PAGE_PRIVILEGE[pathSegment];
      const { data: hasPriv } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }>;
      }).rpc("has_privilege" as never, { p_user_id: user.id, p_privilege: requiredPrivilege } as never);

      if (hasPriv === true) return; // privileged — allow through
    }

    // No access
    throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
