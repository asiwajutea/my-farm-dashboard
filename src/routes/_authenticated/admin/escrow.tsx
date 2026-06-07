import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/escrow")({
  head: () => ({ meta: [{ title: "Escrow · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Escrow Disputes" description="Resolve disputed trades — release to buyer or refund to seller." icon={<Handshake className="h-6 w-6" />} />
  ),
});
