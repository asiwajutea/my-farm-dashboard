import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · VFarmers" },
      { name: "description", content: "How VFarmers collects, uses, and protects your personal information." },
      { property: "og:title", content: "Privacy Policy · VFarmers" },
      { property: "og:description", content: "How VFarmers collects, uses, and protects your personal information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated — to be finalized in Phase 9.</p>
      <div className="prose prose-invert mt-8 max-w-none text-sm text-muted-foreground">
        <p>Full Privacy Policy lands in Phase 9 (Compliance &amp; Trust). This route exists so signup flows and footers have a stable URL to reference today.</p>
      </div>
    </main>
  );
}
