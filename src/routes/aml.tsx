import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/aml")({
  head: () => ({
    meta: [
      { title: "AML Policy · VFarmers" },
      { name: "description", content: "VFarmers Anti-Money-Laundering and Counter-Terrorist-Financing policy." },
      { property: "og:title", content: "AML Policy · VFarmers" },
      { property: "og:description", content: "VFarmers Anti-Money-Laundering and Counter-Terrorist-Financing policy." },
    ],
  }),
  component: AmlPage,
});

function AmlPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">AML Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated — to be finalized in Phase 9.</p>
      <div className="prose prose-invert mt-8 max-w-none text-sm text-muted-foreground">
        <p>Full AML / CFT policy lands in Phase 9 (Compliance &amp; Trust).</p>
      </div>
    </main>
  );
}
