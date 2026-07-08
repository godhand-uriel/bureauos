"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewStatusBadge, TierBadge } from "@/components/platform-badges";
import { getTier, tierIncludesReview, tierRank, SERVICE_TIERS } from "@/lib/packages";
import { useBureauStore } from "@/lib/store";
import type { Case } from "@/lib/types";

/** Case-level service package: what's included, upgrade path, and the next human-assisted action. */
export function ServicePackagePanel({ kase }: { kase: Case }) {
  const tier = getTier(kase.serviceTier);
  const review = useBureauStore((s) => s.reviews.find((r) => r.caseId === kase.id));
  const nextTier = SERVICE_TIERS[tierRank(kase.serviceTier) + 1];

  const humanAction = !tier.humanAssisted
    ? null
    : review && review.status === "in_review"
      ? "A reviewer is examining your case file now."
      : review && review.status === "awaiting_documents"
        ? "The review team is waiting on documents — check your checklist."
        : review && review.status === "changes_requested"
          ? "The reviewer requested changes — see the review notes."
          : review && review.status === "completed"
            ? "Your review is complete — read the reviewer notes."
            : tierIncludesReview(kase.serviceTier)
              ? "You can submit this case for professional review."
              : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Service package
        </CardTitle>
        <TierBadge tier={kase.serviceTier} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tier.tagline}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Included</p>
            <ul className="mt-2 space-y-1.5">
              {tier.included.slice(0, 4).map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not included</p>
            <ul className="mt-2 space-y-1.5">
              {tier.notIncluded.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {humanAction && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-sm">
            <span className="flex-1 text-violet-200">{humanAction}</span>
            {review && <ReviewStatusBadge status={review.status} />}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tierIncludesReview(kase.serviceTier) ? (
            <Link href={`/cases/${kase.id}/review`}>
              <Button size="sm" variant="secondary">
                {review ? "View review status" : "Request review"}
              </Button>
            </Link>
          ) : (
            <Link href={`/cases/${kase.id}/review`}>
              <Button size="sm" variant="secondary">About professional review</Button>
            </Link>
          )}
          {nextTier && (
            <Link href={`/checkout?plan=${nextTier.id}&case=${kase.id}`}>
              <Button size="sm" variant="outline">
                Upgrade to {nextTier.name}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
