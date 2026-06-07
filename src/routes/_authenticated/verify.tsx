import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({ meta: [{ title: "Verify identity · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={9}
      title="Identity Verification (KYC)"
      description="Upload your ID and a selfie to unlock higher limits and full platform access. Reviewed by the VFarmers compliance team."
      icon={<ShieldCheck className="h-6 w-6" />}
    />
  ),
});
