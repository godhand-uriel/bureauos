import type { Metadata } from "next";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { DISCLAIMER_VERSION } from "@/lib/constants";
import { CASE_PASS_NAME } from "@/lib/launch";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/legal/terms" } };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version {DISCLAIMER_VERSION} · Draft</p>
      </div>

      <LegalDraftNotice
        openItems={[
          "The legal name and contact address of the business offering Building202",
          "The refund window and conditions for the Case Pass",
          "Governing law, venue, and how disputes are resolved",
          "Final wording of the warranty disclaimer and limitation of liability",
        ]}
      />

      <section className="space-y-5 text-sm leading-relaxed text-muted-foreground">
        <Section n={1} title="What Building202 is">
          <p>
            Building202 is self-service software for organizing a bureaucratic problem: it asks you
            questions, builds a checklist and action plan from fixed rules, tracks dates, and helps
            you write letters. Building202 is <strong className="text-foreground">not a law firm</strong>,
            does not give legal advice, does not represent you, and does not file or send anything on
            your behalf. Using it creates no attorney-client relationship.
          </p>
          <p>
            The Job Separation Navigator is the only navigator offered as a finished product.
            Deadline calculations in it are currently available for Florida only. The other navigators
            are previews: general organizing tools with no verified deadline rules.
          </p>
        </Section>

        <Section n={2} title="Your account">
          <p>
            You must be at least 18 to create an account. Keep your password private; you are
            responsible for activity in your account. You can download your data or delete your
            account at any time from Settings.
          </p>
        </Section>

        <Section n={3} title="Your responsibilities">
          <p>
            You are responsible for the accuracy of what you enter, for reviewing and editing every
            letter before you use it, and for checking deadlines and requirements with the agency
            handling your matter. A deadline shown in Building202 is calculated only from dates you
            entered and the rule it cites; the date printed on your official notice always controls.
            Where Building202 cannot establish a date, it says NEEDS VERIFICATION — it does not guess.
          </p>
        </Section>

        <Section n={4} title={`The ${CASE_PASS_NAME}`}>
          <p>
            The free service includes the guided intake, action plan, deadline tracking, checklists,
            timeline, and support tickets. The Case Pass is an optional one-time purchase that unlocks
            the letter generator for one Job Separation case. The price is shown before you pay. It is
            not a subscription and does not renew.
          </p>
          <p>
            A Case Pass applies only to the case it was bought for. It cannot be moved to another
            case, and it is removed if the case or your account is deleted. It does not include legal
            advice, review of your case by a person, or any guarantee of a result.
          </p>
        </Section>

        <Section n={5} title="Payments and refunds">
          <p>
            Payments are processed by Stripe on a Stripe-hosted page; Building202 never receives your
            card details. The Case Pass becomes active once Stripe confirms the payment. If a payment
            is refunded, or disputed with your card issuer, the Case Pass is removed while that is
            resolved. Letters you already saved stay in your case.
          </p>
          <p>To ask for a refund, open a support ticket in the Billing category.</p>
        </Section>

        <Section n={6} title="Services not offered">
          <p>
            Human review of your case, document preparation, and other staffed services are not
            currently offered, and Building202 does not store uploaded documents.
          </p>
        </Section>

        <Section n={7} title="No guarantee of outcome">
          <p>
            Outcomes depend on facts, agencies, and rules outside Building202&apos;s control. Building202 does
            not guarantee eligibility for any benefit or the result of any claim, appeal, or dispute.
          </p>
        </Section>

        <Section n={8} title="Availability and changes">
          <p>
            The service is provided as it is and may change, or be interrupted, from time to time.
            Material changes to these terms will be shown to you, and you will be asked to accept the
            new version before continuing to use features that require acceptance.
          </p>
        </Section>
      </section>
    </article>
  );
}
