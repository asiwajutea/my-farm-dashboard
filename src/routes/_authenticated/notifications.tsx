import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={8}
      title="Notifications"
      description="Cycle reaps, transfers, deposit approvals, and escrow updates — all in one place, in real time."
      icon={<Bell className="h-6 w-6" />}
    />
  ),
});
