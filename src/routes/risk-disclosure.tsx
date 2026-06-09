import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";

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
    <LegalLayout
      title="Risk Disclosure"
      current="Risk Disclosure"
      intro="Please read this carefully. Participating in VFarmers involves risk, and you should only participate with amounts you can afford to lose."
    >
      <Section heading="1. Rewards are not guaranteed">
        <p>
          Community rewards on VFarmers depend on overall ecosystem performance and are variable. Past
          performance is not indicative of future results, and there is no promise of profit or
          guaranteed return of any kind.
        </p>
      </Section>
      <Section heading="2. Risk of loss">
        <p>
          The value of Seed and any associated balances can fluctuate. You may lose some or all of the
          amount you commit. Do not participate with funds you cannot afford to lose.
        </p>
      </Section>
      <Section heading="3. Market and liquidity risk">
        <p>
          Conversion rates between Seed and other units may change, and access to deposits, withdrawals,
          or transfers may be affected by market conditions, maintenance, or events beyond our control.
        </p>
      </Section>
      <Section heading="4. Operational and technical risk">
        <p>
          Like any online platform, VFarmers may experience downtime, errors, or security incidents.
          We apply safeguards but cannot eliminate these risks entirely.
        </p>
      </Section>
      <Section heading="5. Regulatory risk">
        <p>
          The regulatory treatment of digital community platforms is evolving. Changes in law or
          regulation may affect the availability of features in your jurisdiction.
        </p>
      </Section>
      <Section heading="6. No financial advice">
        <p>
          Nothing on VFarmers constitutes financial, investment, legal, or tax advice. You are solely
          responsible for your decisions and should seek independent professional advice where
          appropriate.
        </p>
      </Section>
    </LegalLayout>
  );
}
