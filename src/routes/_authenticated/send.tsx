import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "Send · VFarmers" }] }),
  component: () => (
    <PagePlaceholder
      phase={5}
      title="Send to a Farmer"
      description="Transfer Seeds to another Farmer by username or referral code. A small platform fee applies."
      icon={<Send className="h-6 w-6" />}
    />
  ),
});
