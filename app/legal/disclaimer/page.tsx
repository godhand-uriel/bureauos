import type { Metadata } from "next";
import { Callout } from "@/components/callout";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { DISCLAIMER_VERSION } from "@/lib/constants";

export const metadata: Metadata = { title: "Legal Disclaimer" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export default function DisclaimerPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Legal Disclaimer</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version {DISCLAIMER_VERSION} · Draft</p>
      </div>

      <Callout variant="critical" title="The short version">
        BureauOS is self-service software, not a law firm. It does not give legal advice, does not
        represent you, files nothing for you, and cannot promise any outcome.
      </Callout>

      <LegalDraftNotice openItems={[]} />

      <section className="space-y-5 text-sm leading-relaxed text-muted-foreground">
        <Section title="Not legal advice">
          <p>
            Nothing in BureauOS — action plans, checklists, deadlines, letters, rule summaries, or
            helper responses — is legal advice, and none of it creates an attorney-client
            relationship. It is general information to help you get organized.
          </p>
        </Section>

        <Section title="How deadlines work">
          <p>
            A deadline marked as an official rule is calculated only from the date or dates the rule
            depends on, as you entered them (such as the distributed date on a determination), and a
            rule BureauOS checked against the sources it cites, with the date of that check. If any of
            those dates is missing, nothing is calculated. These calculations are currently available for Florida
            unemployment appeals, federal COBRA elections, and Marketplace special enrollment. The
            rules have been checked against their sources by BureauOS but have not yet been reviewed
            by an attorney.
          </p>
          <p>
            If a date can&apos;t be established — a rule isn&apos;t verified for your state, or the
            triggering date isn&apos;t known — the deadline says NEEDS VERIFICATION rather than showing
            a guess. Dates labeled as suggested are BureauOS follow-up targets, not legal deadlines.
            In every case, <strong className="text-foreground">the date printed on your official notice controls</strong>,
            and you should confirm it with the agency.
          </p>
        </Section>

        <Section title="Letters are starting points">
          <p>
            Generated letters are templates filled with your answers. Review every line, fill in
            anything in [BRACKETS], and make sure the facts are right before you send anything.
          </p>
        </Section>

        <Section title="No human review">
          <p>
            No one at BureauOS reviews your case, documents, or letters. Support can help with how the
            app works, not with what you should do.
          </p>
        </Section>

        <Section title="When to get a lawyer">
          <p>
            If you face a hearing, a severance agreement asking you to release claims, possible
            discrimination or retaliation, large sums, or any situation where the stakes are serious,
            talk to a licensed attorney. Legal aid organizations offer free help in many areas, and
            your state bar can refer you to a lawyer.
          </p>
        </Section>
      </section>
    </article>
  );
}
