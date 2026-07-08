import type { Metadata } from "next";
import { Callout } from "@/components/callout";

export const metadata: Metadata = { title: "Legal Disclaimer" };

export default function DisclaimerPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Legal Disclaimer</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version 2026-07-07.v1</p>
      </div>

      <Callout variant="critical" title="The short version">
        BureauOS is not a law firm and does not provide legal advice. It helps you organize
        information, understand common process steps, and prepare next actions.
      </Callout>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="text-base font-semibold text-foreground">Not legal advice</h2>
          <p className="mt-2">
            Nothing in BureauOS — action plans, checklists, letters, jurisdiction notes, assistant
            responses, or review feedback — is legal advice, and none of it creates an
            attorney-client relationship. Content is general process information intended to help
            you get organized.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Verify everything</h2>
          <p className="mt-2">
            Deadlines, fees, forms, and requirements vary by state, county, city, and agency — and
            they change. Always verify requirements with the official agency handling your matter or
            with a qualified professional (attorney, accountant, accredited VSO, licensed adjuster)
            before acting or relying on a deadline.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Professional review</h2>
          <p className="mt-2">
            The professional review workflow is an organizational review of your case file:
            completeness, structure, and preparation. It is not legal representation, and review
            availability depends on BureauOS operations and the availability of qualified
            professionals.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">When to get a lawyer</h2>
          <p className="mt-2">
            If you face a court deadline, an eviction filing, criminal exposure, large sums, or any
            situation where the stakes are serious — talk to a licensed attorney. Legal aid
            organizations offer free help in many areas, and BureauOS plans and letters are designed
            to make that conversation faster, not to replace it.
          </p>
        </div>
      </section>
    </article>
  );
}
