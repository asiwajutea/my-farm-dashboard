import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/coupons")({
  head: () => ({ meta: [{ title: "Coupons · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={5}
      title="Redeem a Coupon"
      description="Enter a coupon code to credit Seeds to your Primary wallet. Each coupon can only be redeemed once per Farmer."
      icon={<Ticket className="h-6 w-6" />}
    />
  ),
});
