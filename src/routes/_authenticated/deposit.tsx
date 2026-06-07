import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({ meta: [{ title: "Deposit · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={3}
      title="Deposit Seeds"
      description="Submit a deposit request via bank transfer, USDT, or card. Once approved by the admin team, Seeds land in your Primary wallet."
      icon={<ArrowDownToLine className="h-6 w-6" />}
    />
  ),
});
