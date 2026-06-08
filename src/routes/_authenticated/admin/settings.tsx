import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings · Admin" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Platform Settings</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure affiliate commissions, profit basis, and maintenance fees.
      </p>
      <Link
        to="/admin/affiliates"
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        <Users className="h-4 w-4" />
        Open Affiliate Settings
      </Link>
    </div>
  );
}
