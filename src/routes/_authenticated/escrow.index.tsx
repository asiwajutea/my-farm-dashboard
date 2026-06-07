import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/escrow/")({
  head: () => ({ meta: [{ title: "Escrow · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={6}
      title="Escrow Trades"
      description="Safely trade with other Farmers. Funds are locked until both parties confirm or an admin resolves a dispute."
      icon={<Handshake className="h-6 w-6" />}
    />
  ),
});
