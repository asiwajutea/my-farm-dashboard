import { type ReactNode } from "react";

// Shared chrome for the public legal/compliance pages (Terms, Privacy, AML,
// Risk Disclosure). Provides a consistent header, effective date, cross-links,
// and prose styling so the four documents read as one coherent set.

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/aml", label: "AML Policy" },
  { href: "/risk-disclosure", label: "Risk Disclosure" },
] as const;

// Single source of truth for the "last updated" date shown across all docs.
export const LEGAL_EFFECTIVE_DATE = "9 June 2026";

export function LegalLayout({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <a href="/" className="text-xs text-primary hover:underline">
        ← Back to VFarmers
      </a>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective {LEGAL_EFFECTIVE_DATE}</p>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{intro}</p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {LEGAL_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            aria-current={l.label === current ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              l.label === current
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </a>
        ))}
      </nav>

      <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>

      <p className="mt-12 border-t border-border/40 pt-6 text-xs text-muted-foreground">
        This document is provided for general information and does not constitute legal, financial,
        or tax advice. VFarmers is a digital farming community; please read the Risk Disclosure
        carefully before participating.
      </p>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      {children}
    </section>
  );
}
