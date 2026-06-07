import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  head: () => ({ meta: [{ title: "Requests · Admin" }] }),
  component: () => (
    <PagePlaceholder phase={7} title="Deposits & Withdrawals" description="Approve or reject pending requests; credits and debits route through the atomic ledger." icon={<Inbox className="h-6 w-6" />} />
  ),
});
