import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/farmers")({
  head: () => ({ meta: [{ title: "Farmers · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Farmers" description="Search, view, freeze, and adjust balances with full audit trail." icon={<Users className="h-6 w-6" />} />
  ),
});
