"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileQuestion, NotebookPen, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { FileStatusBadge, ReviewStatusBadge, TierBadge } from "@/components/platform-badges";
import { fileCategoryLabel } from "@/components/file-upload-panel";
import { Timeline } from "@/components/timeline";
import { getNavigator } from "@/lib/navigators";
import { caseProgress, sortDeadlines } from "@/lib/plan-engine";
import { useBureauStore, useCurrentUser, useHydrated } from "@/lib/store";
import { formatDateOnly, relativeDay } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { CaseStatus } from "@/lib/types";

const STAFF = ["Alex Reyes", "Sam Whitfield", "Priya Nand"];

export default function AdminCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const admin = useCurrentUser();
  const kase = useBureauStore((s) => s.cases.find((c) => c.id === id));
  const users = useBureauStore((s) => s.users);
  const allFiles = useBureauStore((s) => s.files);
  const files = allFiles.filter((f) => f.caseId === id);
  const review = useBureauStore((s) => s.reviews.find((r) => r.caseId === id));
  const setCaseStatus = useBureauStore((s) => s.setCaseStatus);
  const assignCase = useBureauStore((s) => s.assignCase);
  const addCaseAdminNote = useBureauStore((s) => s.addCaseAdminNote);
  const setFileStatus = useBureauStore((s) => s.setFileStatus);
  const [note, setNote] = useState("");

  if (!hydrated || !admin) return null;

  if (!kase) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Case not found"
        description="This case doesn't exist in local data."
        action={<Link href="/admin"><Button>Back to admin</Button></Link>}
      />
    );
  }

  const customer = users.find((u) => u.id === kase.userId);
  const nav = getNavigator(kase.navigatorSlug);
  const missingDocs = kase.documents.filter((d) => d.required && d.status !== "obtained" && d.status !== "not_applicable");
  const openTasks = kase.tasks.filter((t) => !t.done);
  const pendingDeadlines = sortDeadlines(kase.deadlines.filter((d) => d.kind !== "suggested"));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          All cases
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{kase.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{nav?.name}</span>
              <StatusBadge status={kase.status} />
              <PriorityBadge priority={kase.priority} />
              <TierBadge tier={kase.serviceTier} />
              <Badge variant="secondary" className="text-[10px]">{caseProgress(kase)}% complete</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Customer: <span className="font-medium text-foreground">{customer?.name ?? "Unknown"}</span>
              {customer?.email && <span className="text-muted-foreground"> · {customer.email}</span>}
              {customer?.usState && <span> · {customer.usState}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <p className="mb-1 text-xs text-muted-foreground">Status</p>
              <Select
                value={kase.status}
                onChange={(e) => setCaseStatus(kase.id, e.target.value as CaseStatus, "staff")}
                aria-label="Update case status"
              >
                {["intake", "planning", "in_progress", "waiting", "resolved", "closed"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <p className="mb-1 text-xs text-muted-foreground">Assigned to</p>
              <Select
                value={kase.assignedTo ?? ""}
                onChange={(e) => assignCase(kase.id, e.target.value || null)}
                aria-label="Assign case"
              >
                <option value="">Unassigned</option>
                {STAFF.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      {review && (
        <Card className="border-violet-500/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <span className="font-semibold">Review request</span>
              <span className="text-muted-foreground"> — requested {formatDateTime(review.requestedAt)}</span>
            </p>
            <div className="flex items-center gap-2">
              <ReviewStatusBadge status={review.status} />
              <Link href="/admin/reviews"><Button size="sm" variant="outline">Manage</Button></Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Operational snapshot */}
          <Card>
            <CardHeader><CardTitle className="text-base">Case snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Missing required documents ({missingDocs.length})
                </p>
                {missingDocs.length === 0 ? (
                  <p className="mt-1.5 text-muted-foreground">All required documents obtained.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {missingDocs.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {d.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Official / notice deadlines ({pendingDeadlines.length})
                </p>
                {pendingDeadlines.length === 0 ? (
                  <p className="mt-1.5 text-muted-foreground">None.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {pendingDeadlines.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span>{d.title}</span>
                        <span className="text-xs">
                          {d.date ? `${formatDateOnly(d.date)} · ${relativeDay(d.date)}` : "needs verification"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Open tasks ({openTasks.length}) · Letters ({kase.letters.length})
                </p>
                {kase.letters.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {kase.letters.map((l) => (
                      <li key={l.id} className="text-muted-foreground">
                        {l.title} <span className="text-xs">· saved {formatDate(l.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Files to verify */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4 text-primary" />
                Uploaded files ({files.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {files.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No files on this case.</p>
              ) : (
                files.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fileCategoryLabel(f.category)} · {f.sizeLabel} · {formatDate(f.uploadedAt)}
                      </p>
                    </div>
                    <FileStatusBadge status={f.status} />
                    <Select
                      value={f.status}
                      onChange={(e) => setFileStatus(f.id, e.target.value as typeof f.status)}
                      aria-label={`Set status for ${f.name}`}
                      className="h-8 w-36 text-xs"
                    >
                      {["uploaded", "pending_review", "verified", "rejected"].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </Select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Internal notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <NotebookPen className="h-4 w-4 text-primary" />
                Internal notes
                <span className="text-xs font-normal text-muted-foreground">staff only</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kase.adminNotes.length === 0 && (
                <p className="text-sm text-muted-foreground">No internal notes yet.</p>
              )}
              {kase.adminNotes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-card/50 p-3.5">
                  <p className="text-xs font-semibold">{n.authorName}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
                </div>
              ))}
              <form
                className="space-y-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  addCaseAdminNote(kase.id, admin.name, note.trim());
                  setNote("");
                }}
              >
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add an internal note…"
                  aria-label="New internal note"
                />
                <Button type="submit" size="sm" disabled={!note.trim()}>
                  <Send className="h-3.5 w-3.5" />
                  Add note
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base">Case timeline</CardTitle></CardHeader>
            <CardContent>
              <Timeline events={kase.timeline} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
