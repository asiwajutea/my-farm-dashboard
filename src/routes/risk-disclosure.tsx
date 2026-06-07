import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/risk-disclosure")({
  head: () => ({
    meta: [
      { title: "Risk Disclosure · VFarmers" },
      { name: "description", content: "Important information about community rewards, market risk, and platform limitations." },
      { property: "og:title", content: "Risk Disclosure · VFarmers" },
      { property: "og:description", content: "Important information about community rewards, market risk, and platform limitations." },
    ],
  }),
  component: RiskPage,
});

function RiskPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Risk Disclosure</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated — to be finalized in Phase 9.</p>
      <div className="prose prose-invert mt-8 max-w-none text-sm text-muted-foreground">
        <p>Community rewards on VFarmers depend on overall ecosystem performance and are not guaranteed. Full risk disclosure copy lands in Phase 9.</p>
      </div>
    </main>
  );
}
