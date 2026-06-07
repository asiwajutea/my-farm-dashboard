import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Audit Log" description="Every admin action is logged here with actor, target, and payload." icon={<FileText className="h-6 w-6" />} />
  ),
});
