import type { Metadata } from "next";
import { Callout } from "@/components/callout";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version 2026-07-07.v1 · Demo MVP policy</p>
      </div>

      <Callout variant="warning" title="Demo document">
        This is a plain-language placeholder for the BureauOS MVP. Before launch, replace it with a
        policy reviewed by counsel and aligned to your actual data practices.
      </Callout>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="text-base font-semibold text-foreground">1. Where your data lives (in this demo)</h2>
          <p className="mt-2">
            In this local MVP, everything — your account, cases, intake answers, documents metadata,
            letters, tickets — is stored in your browser&apos;s local storage on your device. Nothing is
            transmitted to BureauOS servers, and attached files never leave your device (only their
            name, type, size, and category are tracked).
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">2. What changes in production</h2>
          <p className="mt-2">
            A hosted version of BureauOS would store your data in an encrypted database and encrypted
            file storage, use it only to provide the service, and never sell it. Case data is
            sensitive by nature (housing, employment, health, benefits) and would be treated as
            confidential, with access limited to staff who need it to help you.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">3. Notifications</h2>
          <p className="mt-2">
            Email/SMS notifications are simulated in the demo. In production, your contact details
            would be shared with delivery providers (e.g. Resend, Twilio) solely to deliver the
            notifications you opt into.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">4. Your controls</h2>
          <p className="mt-2">
            You can delete all local data at any time from Settings → Data. In production you would
            be able to export and delete your account data, and notification preferences are always
            under your control.
          </p>
        </div>
      </section>
    </article>
  );
}
