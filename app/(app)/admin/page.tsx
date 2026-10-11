"use client";

import Link from "next/link";
import { CalendarClock, ClipboardCheck, FileWarning, FolderOpen, LifeBuoy, ScrollText, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { ReviewStatusBadge, TicketStatusBadge, TierBadge } from "@/components/platform-badges";
import { getNavigator } from "@/lib/navigators";
import { caseProgress } from "@/lib/plan-engine";
import { useBureauStore, useHydrated } from "@/lib/store";
import { daysFromToday, relativeDay } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function AdminOverviewPage() {
  const hydrated = useHydrated();
  const cases = useBureauStore((s) => s.cases);
  const users = useBureauStore((s) => s.users);
  const tickets = useBureauStore((s) => s.tickets);
  const reviews = useBureauStore((s) => s.reviews);
  const files = useBureauStore((s) => s.files);
  const auditLog = useBureauStore((s) => s.auditLog);

  if (!hydrated) return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;

  const customerName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "Unknown";
  const openCases = cases.filter((c) => c.status !== "closed" && c.status !== "resolved");
  const highPriority = openCases.filter((c) => c.priority === "urgent" || c.priority === "high");
  const newIntakes = cases.filter((c) => !c.intake.completed);
  const pendingReviews = reviews.filter((r) => ["requested", "awaiting_documents", "in_review"].includes(r.status));
  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
  const pendingFiles = files.filter((f) => f.status === "pending_review");
  const missingDocsCases = openCases
    .map((c) => ({ kase: c, missing: c.documents.filter((d) => d.required && d.status !== "obtained" && d.status !== "not_applicable").length }))
    .filter((x) => x.missing > 0);
  // Official / notice deadlines only: due within 14 days, or still undated.
  const upcomingDeadlines = openCases
    .flatMap((c) =>
      c.deadlines
        .filter((d) => d.kind !== "suggested" && (d.date === null || daysFromToday(d.date) <= 14))
        .map((d) => ({ deadline: d, kase: c })),
    )
    .sort((a, b) => (a.deadline.date ?? "9999").localeCompare(b.deadline.date ?? "9999"))
    .slice(0, 8);

  const stats = [
    { label: "Open cases", value: openCases.length, icon: FolderOpen },
    { label: "High priority", value: highPriority.length, icon: Sparkles },
    { label: "Reviews pending", value: pendingReviews.length, icon: ClipboardCheck },
    { label: "Open tickets", value: openTickets.length, icon: LifeBuoy },
    { label: "Files to verify", value: pendingFiles.length, icon: FileWarning },
    { label: "Deadlines to watch", value: upcomingDeadlines.length, icon: CalendarClock },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All cases table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All customer cases</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Case</th>
                <th className="pb-2 pr-3 font-medium">Customer</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Priority</th>
                <th className="pb-2 pr-3 font-medium">Package</th>
                <th className="pb-2 pr-3 font-medium">Progress</th>
                <th className="pb-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {[...cases]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((c) => {
                  const nav = getNavigator(c.navigatorSlug);
                  return (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/cases/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{nav?.shortName}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{customerName(c.userId)}</td>
                      <td className="py-2.5 pr-3"><StatusBadge status={c.status} /></td>
                      <td className="py-2.5 pr-3"><PriorityBadge priority={c.priority} /></td>
                      <td className="py-2.5 pr-3"><TierBadge tier={c.serviceTier} /></td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{caseProgress(c)}%</td>
                      <td className="py-2.5 text-muted-foreground">{formatDate(c.updatedAt)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {cases.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No customer cases yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Needs attention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingReviews.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review queue</p>
                <ul className="mt-2 space-y-1.5">
                  {pendingReviews.map((r) => {
                    const kase = cases.find((c) => c.id === r.caseId);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <Link href="/admin/reviews" className="truncate text-sm text-primary hover:underline">
                          {kase?.title ?? "Case"}
                        </Link>
                        <ReviewStatusBadge status={r.status} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {newIntakes.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Incomplete intakes</p>
                <ul className="mt-2 space-y-1.5">
                  {newIntakes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/admin/cases/${c.id}`} className="truncate text-primary hover:underline">{c.title}</Link>
                      <span className="text-xs text-muted-foreground">{customerName(c.userId)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {missingDocsCases.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing required documents</p>
                <ul className="mt-2 space-y-1.5">
                  {missingDocsCases.map(({ kase, missing }) => (
                    <li key={kase.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/admin/cases/${kase.id}`} className="truncate text-primary hover:underline">{kase.title}</Link>
                      <Badge variant="warning" className="text-[10px]">{missing} missing</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {openTickets.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open tickets</p>
                <ul className="mt-2 space-y-1.5">
                  {openTickets.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/admin/support/${t.id}`} className="truncate text-primary hover:underline">{t.subject}</Link>
                      <TicketStatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pendingReviews.length === 0 && newIntakes.length === 0 && missingDocsCases.length === 0 && openTickets.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">All clear — nothing waiting on staff.</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer deadlines: due within 14 days or unverified</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No official deadlines due or awaiting verification.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlines.map(({ deadline, kase }) => (
                  <li key={deadline.id} className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{deadline.title}</p>
                      {deadline.date ? (
                        <Badge variant={daysFromToday(deadline.date) < 0 ? "destructive" : "warning"} className="text-[10px]">
                          {relativeDay(deadline.date)}
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px]">Needs verification</Badge>
                      )}
                    </div>
                    <Link href={`/admin/cases/${kase.id}`} className="mt-0.5 block text-xs text-primary hover:underline">
                      {kase.title} · {customerName(kase.userId)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit trail (server-written, read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4 text-primary" />
            Recent staff activity
            <span className="text-xs font-normal text-muted-foreground">audit log · read-only</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Staff actions (status changes, notes, review decisions, file verification) are
              recorded here automatically.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {auditLog.slice(0, 12).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-sm">
                  <span className="font-medium">{entry.actorName}</span>
                  <Badge variant="secondary" className="text-[10px]">{entry.action}</Badge>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.detail}</span>
                  <span className="shrink-0 text-xs text-muted-foreground/70">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
