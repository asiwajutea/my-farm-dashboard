import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";

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
    <LegalLayout
      title="AML & CFT Policy"
      current="AML Policy"
      intro="VFarmers is committed to preventing money laundering and the financing of terrorism. This summarises the controls we apply."
    >
      <Section heading="1. Our commitment">
        <p>
          We operate a risk-based Anti-Money-Laundering (AML) and Counter-Terrorist-Financing (CFT)
          program designed to detect, deter, and report suspicious activity, and to comply with
          applicable laws and regulations.
        </p>
      </Section>
      <Section heading="2. Know Your Customer (KYC)">
        <p>
          We verify the identity of users through our KYC process, which may require a government-issued
          document and a selfie. Access to certain features and limits depends on completing
          verification. We may request additional information at any time.
        </p>
      </Section>
      <Section heading="3. Monitoring">
        <p>
          We monitor activity for patterns consistent with money laundering, fraud, or sanctions
          evasion — including unusual transfers, structuring, and use of the platform inconsistent with
          a user's profile. Automated and manual reviews support this monitoring.
        </p>
      </Section>
      <Section heading="4. Sanctions and prohibited persons">
        <p>
          We screen against applicable sanctions lists and prohibit use by sanctioned individuals or
          entities and by persons in prohibited jurisdictions. Accounts found to be in breach may be
          frozen or terminated.
        </p>
      </Section>
      <Section heading="5. Record-keeping and reporting">
        <p>
          We retain verification and transaction records for the periods required by law and may report
          suspicious activity to the relevant authorities. Where legally required, we may not be able to
          notify you of such reports.
        </p>
      </Section>
      <Section heading="6. Cooperation">
        <p>
          You agree to cooperate with reasonable requests for information needed to meet our AML/CFT
          obligations. Failure to do so may result in restricted access.
        </p>
      </Section>
    </LegalLayout>
  );
}
