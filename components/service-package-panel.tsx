"use client";

import Link from "next/link";
import { BadgeCheck, Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewStatusBadge } from "@/components/platform-badges";
import { CASE_PASS_NAME, FREE_INCLUDES, formatPrice, isPaidNavigator } from "@/lib/launch";
import { useBureauStore, useCapabilities, useCasePass } from "@/lib/store";
import type { Case } from "@/lib/types";

/**
 * What this case has access to: the free tools every case gets, and — for
 * the launch navigator — whether the Case Pass is active. Human-assisted
 * review only appears when that service is switched on for the deployment.
 */
export function ServicePackagePanel({ kase }: { kase: Case }) {
  const caps = useCapabilities();
  const hasPass = useCasePass(kase.id);
  const review = useBureauStore((s) => s.reviews.find((r) => r.caseId === kase.id));
  const paid = isPaidNavigator(kase.navigatorSlug);
  if (!caps) return null;
  const price = formatPrice(caps.casePass.priceCents, caps.casePass.currency);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Your access
        </CardTitle>
        {paid ? (
          hasPass ? <Badge variant="success">Case Pass active</Badge> : <Badge variant="secondary">Free</Badge>
        ) : (
          <Badge variant="secondary">Preview navigator</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5">
          {FREE_INCLUDES.slice(0, 4).map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {item}
            </li>
          ))}
        </ul>

        {paid && hasPass && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="flex-1 text-emerald-200">Letter generator unlocked for this case.</span>
            <Link href={`/cases/${kase.id}/letters`}>
              <Button size="sm" variant="secondary">Open letters</Button>
            </Link>
          </div>
        )}

        {paid && !hasPass && (
          <div className="rounded-lg border border-border bg-card/50 p-3.5">
            <p className="text-sm font-medium">
              {CASE_PASS_NAME} — {price}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              One-time payment that unlocks the letter generator for this case. Self-service
              software — not legal advice, and no one reviews your case.
            </p>
            <Link href={`/cases/${kase.id}/letters`} className="mt-3 inline-block">
              <Button size="sm" variant="outline">See what&apos;s included</Button>
            </Link>
          </div>
        )}

        {!paid && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            This navigator is in preview: organizing tools only, with deadlines you verify yourself.
            Nothing is sold for it.
          </p>
        )}

        {caps.humanReview && review && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-sm">
            <span className="flex-1 text-violet-200">Review request on file.</span>
            <ReviewStatusBadge status={review.status} />
            <Link href={`/cases/${kase.id}/review`}>
              <Button size="sm" variant="secondary">View</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
