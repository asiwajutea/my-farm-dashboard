import { createFileRoute } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/farm")({
  head: () => ({ meta: [{ title: "Farm · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={4}
      title="Farming Cycles"
      description="Lock Seeds from your Farming wallet for a chosen duration, pick a booster, and reap rewards once the cycle matures."
      icon={<Sprout className="h-6 w-6" />}
    />
  ),
});
