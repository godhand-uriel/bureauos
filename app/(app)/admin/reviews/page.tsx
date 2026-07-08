"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { ReviewStatusBadge, TierBadge } from "@/components/platform-badges";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { ReviewStatus } from "@/lib/types";

const REVIEW_STATUSES: ReviewStatus[] = [
  "requested",
  "awaiting_documents",
  "in_review",
  "changes_requested",
  "completed",
  "declined",
];

export default function AdminReviewsPage() {
  const hydrated = useHydrated();
  const admin = useCurrentUser();
  const reviews = useBureauStore((s) => s.reviews);
  const cases = useBureauStore((s) => s.cases);
  const users = useBureauStore((s) => s.users);
  const setReviewStatus = useBureauStore((s) => s.setReviewStatus);
  const addReviewerNote = useBureauStore((s) => s.addReviewerNote);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!hydrated || !admin) return null;

  const sorted = [...reviews].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No review requests"
        description="Customer review requests appear here as they come in."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((review) => {
        const kase = cases.find((c) => c.id === review.caseId);
        const customer = users.find((u) => u.id === review.userId);
        const missingDocs = kase?.documents.filter((d) => d.required && d.status !== "obtained" && d.status !== "not_applicable") ?? [];
        const draft = drafts[review.id] ?? "";
        return (
          <Card key={review.id}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">
                {kase ? (
                  <Link href={`/admin/cases/${kase.id}`} className="text-primary hover:underline">
                    {kase.title}
                  </Link>
                ) : (
                  "Case removed"
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {kase && <TierBadge tier={kase.serviceTier} />}
                <ReviewStatusBadge status={review.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {customer?.name ?? "Unknown customer"} · requested {formatDateTime(review.requestedAt)} ·
                {" "}{missingDocs.length} required document{missingDocs.length === 1 ? "" : "s"} missing
              </p>

              <div className="rounded-lg border border-border bg-card/50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer notes</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{review.customerNotes}</p>
              </div>

              {review.reviewerNotes.length > 0 && (
                <div className="space-y-2">
                  {review.reviewerNotes.map((n) => (
                    <div key={n.id} className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3.5 text-sm">
                      <p className="text-xs font-semibold text-violet-300">{n.authorName}</p>
                      <p className="mt-1 leading-relaxed text-violet-100/90">{n.body}</p>
                      <p className="mt-1.5 text-[10px] text-violet-300/60">{formatDateTime(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-48">
                  <p className="mb-1 text-xs text-muted-foreground">Status</p>
                  <Select
                    value={review.status}
                    onChange={(e) => setReviewStatus(review.id, e.target.value as ReviewStatus)}
                    aria-label="Update review status"
                  >
                    {REVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </Select>
                </div>
                <form
                  className="flex min-w-[16rem] flex-1 items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    addReviewerNote(review.id, admin.name, draft.trim());
                    setDrafts({ ...drafts, [review.id]: "" });
                  }}
                >
                  <div className="flex-1">
                    <p className="mb-1 text-xs text-muted-foreground">Reviewer note (visible to customer)</p>
                    <Textarea
                      value={draft}
                      onChange={(e) => setDrafts({ ...drafts, [review.id]: e.target.value })}
                      rows={1}
                      placeholder="e.g. Letter looks strong; add the physician's support letter before sending."
                      aria-label="Reviewer note"
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={!draft.trim()}>
                    <Send className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
