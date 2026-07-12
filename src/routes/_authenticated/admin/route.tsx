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

    // Non-admins: check if they have ANY admin capability privilege.
    // The admin index page (/admin) is accessible to any privileged user.
    // Specific sub-pages check for their specific privilege below.
    const { data: privRows } = await supabase
      .from("user_privileges")
      .select("privilege")
      .eq("user_id", user.id)
      .in("privilege", Object.values(PAGE_PRIVILEGE));

    const hasAnyPrivilege = privRows && privRows.length > 0;
    if (!hasAnyPrivilege) throw redirect({ to: "/dashboard" });

    // For the index page (/admin or /admin/) any privilege grants access
    const pathSegment = location.pathname.replace(/^\/admin\/?/, "").split("/")[0];
    if (!pathSegment) return; // index — allowed for any privileged user

    // For a specific sub-page, check the required privilege
    if (PAGE_PRIVILEGE[pathSegment]) {
      const requiredPrivilege = PAGE_PRIVILEGE[pathSegment];
      const hasRequired = privRows.some((r) => r.privilege === requiredPrivilege);
      if (hasRequired) return;
      throw redirect({ to: "/admin" }); // has privileges but not for this page
    }

    // Unknown page segment — allow through (admin-only pages have their own guards)
    return;
  },
  component: () => <Outlet />,
});
