"use client";

import Link from "next/link";
import { CalendarClock, CheckSquare, Compass, FolderOpen, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseCard } from "@/components/case-card";
import { DeadlineCard } from "@/components/deadline-card";
import { EmptyState } from "@/components/empty-state";
import { NavigatorIcon } from "@/components/navigator-icon";
import { NextActionPanel } from "@/components/next-action-panel";
import { Timeline } from "@/components/timeline";
import { NAVIGATORS } from "@/lib/navigators";
import { caseProgress, nextActionFor } from "@/lib/plan-engine";
import { useBureauStore, useCurrentUser, useHydrated, useMyCases } from "@/lib/store";
import type { Deadline } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const hydrated = useHydrated();
  const cases = useMyCases();
  const user = useCurrentUser();
  const toggleDeadlineVerified = useBureauStore((s) => s.toggleDeadlineVerified);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-md bg-secondary" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  const activeCases = cases.filter((c) => c.status !== "closed" && c.status !== "resolved");
  // Official and notice dates first (dated, then those still needing a date),
  // suggested follow-ups last. Completed suggestions drop off.
  const deadlineRank = (d: Deadline) => (d.kind === "suggested" ? 2 : d.date ? 0 : 1);
  const upcomingDeadlines = activeCases
    .flatMap((c) =>
      c.deadlines
        .filter((d) => !(d.kind === "suggested" && d.verified))
        .map((d) => ({ deadline: d, kase: c })),
    )
    .sort(
      (a, b) =>
        deadlineRank(a.deadline) - deadlineRank(b.deadline) ||
        (a.deadline.date ?? "").localeCompare(b.deadline.date ?? ""),
    )
    .slice(0, 6);
  const openTasks = cases
    .flatMap((c) => c.tasks.filter((t) => !t.done).map((t) => ({ task: t, kase: c })))
    .sort((a, b) => (a.task.dueDate || "9999").localeCompare(b.task.dueDate || "9999"))
    .slice(0, 6);
  const recentEvents = cases
    .flatMap((c) => c.timeline)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  // Recommended next action: the most urgent active case's next step.
  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
  const focusCase = [...activeCases].sort((a, b) => {
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    return p !== 0 ? p : caseProgress(a) - caseProgress(b);
  })[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {activeCases.length === 0
            ? "No active cases — start one below."
            : `${activeCases.length} active case${activeCases.length === 1 ? "" : "s"}, ${openTasks.length}${openTasks.length === 6 ? "+" : ""} open task${openTasks.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      {focusCase && (
        <NextActionPanel
          {...nextActionFor(focusCase)}
          detail={`${focusCase.title} — ${nextActionFor(focusCase).detail}`}
        />
      )}

      {/* Active cases */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FolderOpen className="h-5 w-5 text-primary" />
            Active cases
          </h2>
          <Link href="/navigators" className="text-sm font-medium text-primary hover:underline">
            Start new case
          </Link>
        </div>
        {activeCases.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No active cases"
            description="Pick a navigator below to start your first case. It takes about five minutes."
            action={
              <Link href="/navigators">
                <Button>Browse navigators</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeCases.map((c) => (
              <CaseCard key={c.id} kase={c} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Deadlines and dates to watch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingDeadlines.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing to track yet. Deadlines appear here once a case has an action plan.
              </p>
            ) : (
              upcomingDeadlines.map(({ deadline, kase }) => (
                <DeadlineCard
                  key={deadline.id}
                  deadline={deadline}
                  caseTitle={kase.title}
                  compact
                  onToggleVerified={() => toggleDeadlineVerified(kase.id, deadline.id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Open tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-primary" />
              Open tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openTasks.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                All caught up. New tasks appear when you generate an action plan.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {openTasks.map(({ task, kase }) => (
                  <li key={task.id}>
                    <Link
                      href={`/cases/${kase.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-primary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{kase.title}</p>
                      </div>
                      {task.dueDate && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Activity across your cases shows up here.</p>
            ) : (
              <Timeline events={recentEvents} />
            )}
          </CardContent>
        </Card>

        {/* Quick start + cases by navigator */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="h-4 w-4 text-primary" />
              Quick start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {NAVIGATORS.map((nav) => {
              const count = cases.filter((c) => c.navigatorSlug === nav.slug).length;
              return (
                <Link
                  key={nav.slug}
                  href={`/cases/new?navigator=${nav.slug}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-colors",
                    "hover:border-border hover:bg-accent/50",
                  )}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `hsl(${nav.accent} / 0.15)`, color: `hsl(${nav.accent})` }}
                  >
                    <NavigatorIcon icon={nav.icon} className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{nav.shortName}</span>
                  {count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {count} case{count === 1 ? "" : "s"}
                    </span>
                  )}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
