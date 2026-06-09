import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";

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
    <LegalLayout
      title="Terms of Service"
      current="Terms of Service"
      intro="These Terms govern your access to and use of the VFarmers platform. By creating an account or using the service you agree to them."
    >
      <Section heading="1. Acceptance of these Terms">
        <p>
          By registering for, accessing, or using VFarmers you confirm that you have read, understood,
          and agree to be bound by these Terms and our Privacy Policy, AML Policy, and Risk Disclosure.
          If you do not agree, do not use the platform.
        </p>
      </Section>
      <Section heading="2. Eligibility">
        <p>
          You must be at least 18 years old (or the age of majority in your jurisdiction) and legally
          permitted to use the service. Where required, you must complete identity verification (KYC)
          before accessing certain features or limits. You may not use VFarmers if you are subject to
          sanctions or located in a prohibited jurisdiction.
        </p>
      </Section>
      <Section heading="3. Your account">
        <p>
          You are responsible for safeguarding your login credentials and for all activity under your
          account. Notify us immediately of any unauthorized use. We may suspend or freeze accounts
          that violate these Terms, show signs of fraud, or are required to be restricted by law.
        </p>
      </Section>
      <Section heading="4. Seed, wallets, and community rewards">
        <p>
          "Seed" is an in-platform unit used to participate in farming cycles and community features.
          Community rewards depend on overall ecosystem performance and are not guaranteed. Balances,
          transfers, escrow, and rewards are recorded in your account ledger. See the Risk Disclosure
          for important information about variability and the possibility of loss.
        </p>
      </Section>
      <Section heading="5. Prohibited conduct">
        <p>
          You agree not to use the platform for unlawful purposes, money laundering, fraud, market
          manipulation, or to circumvent verification, fees, or limits. You may not abuse referral or
          affiliate features, create accounts to evade restrictions, or interfere with the platform's
          operation or security.
        </p>
      </Section>
      <Section heading="6. Fees">
        <p>
          Transfers, withdrawals, maintenance, and other features may carry fees, which are disclosed
          in the interface before you confirm an action. Fees may change over time; continued use after
          a change constitutes acceptance.
        </p>
      </Section>
      <Section heading="7. Suspension and termination">
        <p>
          We may suspend, freeze, or terminate access at our discretion where necessary to comply with
          law, protect users, or enforce these Terms. You may stop using the service at any time.
        </p>
      </Section>
      <Section heading="8. Disclaimers and limitation of liability">
        <p>
          The service is provided "as is" without warranties of any kind. To the maximum extent
          permitted by law, VFarmers is not liable for indirect, incidental, or consequential damages,
          or for losses arising from community-reward variability, market conditions, or your failure
          to secure your account.
        </p>
      </Section>
      <Section heading="9. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Material changes will be communicated in-app or
          by other reasonable means. The "Effective" date above reflects the latest revision.
        </p>
      </Section>
      <Section heading="10. Contact">
        <p>Questions about these Terms can be sent to the VFarmers support team via the in-app help.</p>
      </Section>
    </LegalLayout>
  );
}
