"use client";

import Link from "next/link";
import { Check, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CASE_PASS_EXCLUDES, CASE_PASS_INCLUDES, CASE_PASS_NAME, formatPrice } from "@/lib/launch";
import { useCapabilities } from "@/lib/store";

/**
 * What the Case Pass is, what it costs, and — stated just as plainly — what
 * it is not. Shown wherever the paid feature is locked. The price comes from
 * the server's configuration, and the purchase button only appears when this
 * deployment can actually take a payment.
 */
export function CasePassOffer({ caseId, compact = false }: { caseId: string; compact?: boolean }) {
  const caps = useCapabilities();
  if (!caps) return null;
  const price = formatPrice(caps.casePass.priceCents, caps.casePass.currency);

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{CASE_PASS_NAME}</h2>
              <p className="text-lg font-bold">
                {price} <span className="text-xs font-normal text-muted-foreground">one time, this case</span>
              </p>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The letter generator for this case is part of the Case Pass. Your plan, deadlines,
              checklists, and timeline stay free either way.
            </p>
          </div>
        </div>

        {!compact && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Includes</p>
              <ul className="mt-2 space-y-1.5">
                {CASE_PASS_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Does not include</p>
              <ul className="mt-2 space-y-1.5">
                {CASE_PASS_EXCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {caps.payments !== "off" ? (
          <Link href={`/checkout?case=${caseId}`} className="inline-block">
            <Button>Get the Case Pass — {price}</Button>
          </Link>
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg border border-border bg-card/50 p-3 text-sm text-muted-foreground">
              Purchases aren&apos;t available right now. Everything else in your case keeps working.
            </p>
            {caps.devTools && (
              <Link href={`/checkout?case=${caseId}`} className="inline-block">
                <Button variant="outline" size="sm">Open checkout (development tools)</Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
