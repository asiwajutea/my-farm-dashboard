import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · VFarmers" },
      { name: "description", content: "VFarmers Terms of Service — your rights, obligations, and platform rules." },
      { property: "og:title", content: "Terms of Service · VFarmers" },
      { property: "og:description", content: "Your rights, obligations, and platform rules on VFarmers." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated — to be finalized in Phase 9.</p>
      <div className="prose prose-invert mt-8 max-w-none text-sm text-muted-foreground">
        <p>Full Terms of Service content lands in Phase 9 (Compliance &amp; Trust). This route exists so signup flows, footers, and external links can reference a stable URL.</p>
        <h2 className="mt-6 text-base font-semibold text-foreground">1. Acceptance</h2>
        <p>By using VFarmers you agree to these Terms once they are finalized.</p>
        <h2 className="mt-6 text-base font-semibold text-foreground">2. Eligibility</h2>
        <p>You must be of legal age in your jurisdiction and complete identity verification where required.</p>
        <h2 className="mt-6 text-base font-semibold text-foreground">3. Risk</h2>
        <p>See the <a href="/risk-disclosure" className="text-primary underline">Risk Disclosure</a> for important information about community rewards.</p>
      </div>
    </main>
  );
}
