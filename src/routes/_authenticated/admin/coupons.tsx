import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Coupons" description="Create promo codes, set redemption limits and expiry, disable existing coupons." icon={<Ticket className="h-6 w-6" />} />
  ),
});
