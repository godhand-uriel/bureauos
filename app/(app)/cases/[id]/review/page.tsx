"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ClipboardCheck, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Callout } from "@/components/callout";
import { DisclaimerGate } from "@/components/disclaimer-gate";
import { ReviewStatusBadge } from "@/components/platform-badges";
import { getTier, tierIncludesReview } from "@/lib/packages";
import { useBureauStore, useCase, useHydrated } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/utils";
import type { ReviewStatus } from "@/lib/types";

const STATUS_STEPS: ReviewStatus[] = ["requested", "awaiting_documents", "in_review", "completed"];

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const kase = useCase(id);
  const review = useBureauStore((s) => s.reviews.find((r) => r.caseId === id));
  const requestReview = useBureauStore((s) => s.requestReview);
  const [notes, setNotes] = useState("");

  if (!hydrated || !kase) return null;

  const tier = getTier(kase.serviceTier);
  const eligible = tierIncludesReview(kase.serviceTier);
  const requiredDocs = kase.documents.filter((d) => d.required);
  const obtainedRequired = requiredDocs.filter((d) => d.status === "obtained").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Professional review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your case file for a structured review: completeness, organization, and flagged gaps.
        </p>
      </div>

      <Callout variant="info" title="What review is (and isn't)">
        Review is an organizational check of your case file by the BureauOS team and, where
        available, qualified professionals. It is not legal representation or legal advice, and
        review availability depends on BureauOS operations. You always decide what to send and when.
      </Callout>

      {/* Status tracker */}
      {review && (
        <Card className="border-primary/30">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Review status
            </CardTitle>
            <ReviewStatusBadge status={review.status} />
          </CardHeader>
          <CardContent className="space-y-5">
            {review.status !== "declined" && review.status !== "changes_requested" && (
              <ol className="flex flex-wrap items-center gap-2">
                {STATUS_STEPS.map((step, i) => {
                  const currentIdx = STATUS_STEPS.indexOf(review.status);
                  const reached = currentIdx >= i;
                  return (
                    <li key={step} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                          reached ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {reached && currentIdx > i ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className={cn("text-xs", reached ? "font-medium" : "text-muted-foreground")}>
                        {step.replace(/_/g, " ")}
                      </span>
                      {i < STATUS_STEPS.length - 1 && <span className="h-px w-4 bg-border" aria-hidden />}
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="rounded-lg border border-border bg-card/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your notes to the reviewer</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{review.customerNotes}</p>
              <p className="mt-2 text-[10px] text-muted-foreground/70">Requested {formatDateTime(review.requestedAt)}</p>
            </div>
            {review.reviewerNotes.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviewer feedback</p>
                <div className="mt-2 space-y-2">
                  {review.reviewerNotes.map((n) => (
                    <div key={n.id} className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3.5 text-sm">
                      <p className="text-xs font-semibold text-violet-300">{n.authorName} · BureauOS</p>
                      <p className="mt-1 leading-relaxed text-violet-100/90">{n.body}</p>
                      <p className="mt-1.5 text-[10px] text-violet-300/60">{formatDateTime(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Document readiness
          </CardTitle>
          <CardDescription>
            Reviews go faster when required documents are in. {obtainedRequired}/{requiredDocs.length} required documents obtained.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {requiredDocs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    d.status === "obtained" ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
                {d.name}
              </li>
            ))}
          </ul>
          <Link href={`/cases/${kase.id}/documents`} className="mt-4 inline-block">
            <Button variant="outline" size="sm">Open document checklist</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Request form or upgrade prompt */}
      {!eligible ? (
        <Card className="border-amber-500/30">
          <CardContent className="p-6">
            <h3 className="font-semibold">Review isn&apos;t included in {tier.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Professional review is part of Assisted Review and above. Upgrade this case&apos;s service
              package to submit your file for review.
            </p>
            <Link href={`/checkout?plan=assisted_review&case=${kase.id}`} className="mt-4 inline-block">
              <Button>
                Upgrade to Assisted Review — $29/mo
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : !review || review.status === "declined" || review.status === "completed" || review.status === "changes_requested" ? (
        <DisclaimerGate caseId={kase.id} action="request a review">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {review ? "Request another review" : "Request review"}
              </CardTitle>
              <CardDescription>
                Tell the reviewer what you want checked — a letter draft, evidence completeness, or the whole file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!notes.trim()) return;
                  requestReview(kase.id, notes.trim());
                  setNotes("");
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="review-notes">Notes for the reviewer</Label>
                  <Textarea
                    id="review-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="e.g. Please check whether my appeal letter addresses the denial reason, and whether my evidence list has gaps."
                    required
                  />
                </div>
                <Button type="submit" disabled={!notes.trim()}>
                  <Send className="h-4 w-4" />
                  Submit for review
                </Button>
              </form>
            </CardContent>
          </Card>
        </DisclaimerGate>
      ) : null}
    </div>
  );
}
