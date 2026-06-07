import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/escrow/$id")({
  head: () => ({ meta: [{ title: "Escrow detail · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={6}
      title="Escrow Detail"
      description="View the full lifecycle of this escrow trade: funding, release, dispute, or refund."
      icon={<Handshake className="h-6 w-6" />}
    />
  ),
});
