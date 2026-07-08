import type { Metadata } from "next";
import { Callout } from "@/components/callout";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version 2026-07-07.v1 · Demo MVP terms</p>
      </div>

      <Callout variant="warning" title="Demo document">
        This is a plain-language placeholder for the BureauOS MVP. Before any commercial launch,
        replace it with terms drafted or reviewed by a qualified attorney.
      </Callout>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="text-base font-semibold text-foreground">1. What BureauOS is</h2>
          <p className="mt-2">
            BureauOS is an organizational tool for bureaucratic processes. It helps you collect
            information, track tasks and deadlines, prepare documents and letters, and understand
            common process steps. BureauOS is <strong className="text-foreground">not a law firm</strong>,
            does not provide legal advice, and no attorney-client relationship is created by using it.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">2. Your responsibilities</h2>
          <p className="mt-2">
            You are responsible for the accuracy of information you enter, for reviewing and editing
            any generated letter or plan before using it, and for verifying deadlines and requirements
            with the relevant official agency or a qualified professional. Deadlines and requirements
            vary by jurisdiction and change over time.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">3. Service packages</h2>
          <p className="mt-2">
            Paid packages add organizational review and preparation support by the BureauOS team.
            Human-assisted services depend on operational availability. Professional review is an
            organizational review of your case file — it is not legal representation.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">4. Accounts and data</h2>
          <p className="mt-2">
            You are responsible for keeping your account credentials secure. In this local demo, all
            data is stored in your browser. See the Privacy Policy for how data is handled.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">5. No guarantees of outcome</h2>
          <p className="mt-2">
            Bureaucratic outcomes depend on facts, agencies, and rules outside our control. BureauOS
            makes no guarantee that any application, appeal, claim, or dispute will succeed.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">6. Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, BureauOS is provided &quot;as is&quot; and our liability is
            limited to the amount you paid for the service in the preceding 12 months.
          </p>
        </div>
      </section>
    </article>
  );
}
