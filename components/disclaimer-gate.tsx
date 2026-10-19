"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useBureauStore, useHasAccepted } from "@/lib/store";

/**
 * Blocks plan generation, letters, and review requests until the user has
 * accepted the current terms/privacy/disclaimer version. Acceptance is
 * recorded per user (with version + timestamp, optionally case-linked).
 */
export function DisclaimerGate({
  caseId,
  action,
  children,
}: {
  caseId: string | null;
  /** What the user is about to do, e.g. "generate your action plan". */
  action: string;
  children: React.ReactNode;
}) {
  const accepted = useHasAccepted(caseId);
  const acceptDisclaimers = useBureauStore((s) => s.acceptDisclaimers);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false);

  if (accepted) return <>{children}</>;

  const ready = terms && privacy && disclaimer;

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Before you {action}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              A one-time acknowledgement so we&apos;re on the same page about what Building202 is —
              and isn&apos;t.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
          <p>• Building202 is <strong className="text-foreground">not a law firm</strong> and does not provide legal advice.</p>
          <p>• Building202 helps you organize information, understand common process steps, and prepare next actions.</p>
          <p>• Deadlines and requirements vary by jurisdiction — always verify with official agencies or qualified professionals.</p>
          <p>• Generated letters and plans are starting points you review, edit, and own.</p>
        </div>

        <div className="space-y-3">
          {[
            { checked: terms, set: setTerms, label: "I accept the", link: "/legal/terms", linkText: "Terms of Service" },
            { checked: privacy, set: setPrivacy, label: "I accept the", link: "/legal/privacy", linkText: "Privacy Policy" },
            { checked: disclaimer, set: setDisclaimer, label: "I understand the", link: "/legal/disclaimer", linkText: "Legal Disclaimer" },
          ].map((row) => (
            <label key={row.link} className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={row.checked} onCheckedChange={row.set} aria-label={row.linkText} />
              <span>
                {row.label}{" "}
                <Link href={row.link} target="_blank" className="font-medium text-primary underline underline-offset-2">
                  {row.linkText}
                </Link>
              </span>
            </label>
          ))}
        </div>

        <Button disabled={!ready} onClick={() => acceptDisclaimers(caseId)}>
          <ShieldCheck className="h-4 w-4" />
          Accept and continue
        </Button>
      </CardContent>
    </Card>
  );
}
