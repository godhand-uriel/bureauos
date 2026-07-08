"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckSquare, ClipboardList, FilePen, FileText, Flag, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { DeadlineCard } from "@/components/deadline-card";
import { NextActionPanel } from "@/components/next-action-panel";
import { ServicePackagePanel } from "@/components/service-package-panel";
import { TaskChecklist } from "@/components/task-checklist";
import { Timeline } from "@/components/timeline";
import { nextActionFor } from "@/lib/plan-engine";
import { useBureauStore, useCase, useHydrated } from "@/lib/store";

export default function CaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const kase = useCase(id);
  const toggleTask = useBureauStore((s) => s.toggleTask);
  const addTask = useBureauStore((s) => s.addTask);
  const toggleDeadlineVerified = useBureauStore((s) => s.toggleDeadlineVerified);

  if (!hydrated || !kase) return null; // layout handles loading & not-found

  const next = nextActionFor(kase);
  const pendingDeadlines = kase.deadlines.filter((d) => !d.verified).sort((a, b) => a.date.localeCompare(b.date));
  const neededDocs = kase.documents.filter((d) => d.status === "needed" || d.status === "requested");
  const recentEvents = [...kase.timeline].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="space-y-6">
      {!kase.intake.completed && (
        <Callout variant="warning" title="Intake incomplete">
          Finish the guided intake to generate your personalized action plan.{" "}
          <Link href={`/cases/${kase.id}/intake`} className="font-semibold underline underline-offset-2">
            Continue intake
          </Link>
        </Callout>
      )}

      <NextActionPanel {...next} />

      {/* Risk flags */}
      {kase.plan && kase.plan.riskFlags.length > 0 && (
        <div className="space-y-2">
          {kase.plan.riskFlags.map((flag) => (
            <Callout
              key={flag.id}
              variant={flag.severity === "critical" ? "critical" : flag.severity === "warning" ? "warning" : "info"}
              title={flag.label}
            >
              {flag.detail}
            </Callout>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-primary" />
              Tasks
              <span className="text-xs font-normal text-muted-foreground">
                {kase.tasks.filter((t) => t.done).length}/{kase.tasks.length} done
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kase.tasks.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Tasks appear once your action plan is generated.
              </p>
            ) : (
              <TaskChecklist
                tasks={kase.tasks}
                onToggle={(taskId) => toggleTask(kase.id, taskId)}
                onAdd={(title) => addTask(kase.id, title)}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Service package */}
          <ServicePackagePanel kase={kase} />

          {/* Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary" />
                Deadlines to verify
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingDeadlines.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No unverified deadlines.</p>
              ) : (
                pendingDeadlines.map((d) => (
                  <DeadlineCard
                    key={d.id}
                    deadline={d}
                    onToggleVerified={() => toggleDeadlineVerified(kase.id, d.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/cases/${kase.id}/documents`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Documents</p>
                  <p className="text-xs text-muted-foreground">{neededDocs.length} outstanding</p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/cases/${kase.id}/letters`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <FilePen className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Letters</p>
                  <p className="text-xs text-muted-foreground">{kase.letters.length} saved</p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/cases/${kase.id}/plan`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Action plan</p>
                  <p className="text-xs text-muted-foreground">{kase.plan ? "Generated" : "Not yet generated"}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/cases/${kase.id}/timeline`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <History className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Timeline</p>
                  <p className="text-xs text-muted-foreground">{kase.timeline.length} events</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4 text-primary" />
            Recent activity
          </CardTitle>
          <Link href={`/cases/${kase.id}/timeline`}>
            <Button variant="ghost" size="sm">
              Full timeline
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Timeline events={recentEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
