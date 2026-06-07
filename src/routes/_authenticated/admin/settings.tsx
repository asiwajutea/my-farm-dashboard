import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Platform Settings" description="Seed/USDT rate, P2P and withdrawal fees, minimum cycle amount, booster catalog." icon={<Settings className="h-6 w-6" />} />
  ),
});
