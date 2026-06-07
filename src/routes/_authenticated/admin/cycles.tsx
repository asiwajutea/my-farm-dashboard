import { createFileRoute } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/cycles")({
  head: () => ({ meta: [{ title: "Cycles · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Farming Cycles" description="Inspect, force-mature, or cancel any active cycle." icon={<Sprout className="h-6 w-6" />} />
  ),
});
