import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpFromLine } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({ meta: [{ title: "Withdraw · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={3}
      title="Withdraw Seeds"
      description="Request a withdrawal from your Primary wallet to a supported destination. Subject to admin review and the configured withdrawal fee."
      icon={<ArrowUpFromLine className="h-6 w-6" />}
    />
  ),
});
