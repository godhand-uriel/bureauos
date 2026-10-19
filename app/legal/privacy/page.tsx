import type { Metadata } from "next";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { DISCLAIMER_VERSION } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy" } };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version {DISCLAIMER_VERSION} · Draft</p>
      </div>

      <LegalDraftNotice
        openItems={[
          "The business's legal name and a privacy contact address",
          "The hosting and database providers, named",
          "How long payment records are kept, and state-specific privacy rights wording",
        ]}
      />

      <section className="space-y-5 text-sm leading-relaxed text-muted-foreground">
        <Section title="What Building202 stores">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your account: name, email address, state, and a one-way hash of your password (never the password itself).</li>
            <li>
              What you enter in your cases: intake answers, dates, notes, checklist progress, and
              letters. This can include sensitive details about your job, pay, health coverage, or
              benefits — enter only what you need.
            </li>
            <li>Support tickets and the replies to them.</li>
            <li>A record of which terms version you accepted, and when.</li>
            <li>A log of emails Building202 sent you.</li>
            <li>Purchase records: amount, date, and status. Never card details.</li>
          </ul>
          <p>
            Building202 does not store uploaded documents — there is no upload feature. It has no
            advertising or third-party analytics, and it does not sell or rent your data.
          </p>
        </Section>

        <Section title="Who else handles it">
          <ul className="list-disc space-y-1 pl-5">
            <li>Stripe processes payments. Your card details go to Stripe, not to Building202.</li>
            <li>Resend delivers email: it receives your email address and the message.</li>
            <li>
              A rate-limiting service may receive a key derived from your IP address, used only to
              block abusive traffic.
            </li>
            <li>The hosting and database providers store the data on Building202&apos;s behalf.</li>
          </ul>
          <p>
            Building202 staff can see your case to answer support requests. Staff actions on your case
            are recorded in an audit log, and staff accounts must use two-factor sign-in.
          </p>
        </Section>

        <Section title="How long it is kept">
          <p>
            Your account and cases are kept until you delete them. Email logs are removed after about
            six months, and checkout attempts that were never paid after about 30 days. When you
            delete your account, your cases and everything in them are deleted. Records of payments
            are kept for financial record-keeping, with your name and email removed from them.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-5">
            <li>Download everything Building202 holds about your account: Settings → Your data.</li>
            <li>Delete a single case from the case page, or your whole account from Settings.</li>
            <li>Choose which emails you receive: Settings → Notifications.</li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            Connections are encrypted (HTTPS). Passwords are stored only as salted hashes, and
            changing your password signs out every device. No system is perfectly secure; if
            Building202 learns of a breach affecting your data, it will tell you as the law requires.
          </p>
        </Section>
      </section>
    </article>
  );
}
