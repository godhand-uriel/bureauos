"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, FilePen, FileText, ListOrdered, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { DeadlineCard } from "@/components/deadline-card";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge } from "@/components/status-badge";
import { getNavigator } from "@/lib/navigators";
import { rulesForCase } from "@/lib/jurisdictions";
import { useBureauStore, useCase, useHydrated } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const kase = useCase(id);
  const regeneratePlan = useBureauStore((s) => s.regeneratePlan);
  const toggleDeadlineVerified = useBureauStore((s) => s.toggleDeadlineVerified);

  if (!hydrated || !kase) return null;
  const nav = getNavigator(kase.navigatorSlug);

  if (!kase.plan) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No action plan yet"
        description={
          kase.intake.completed
            ? "Intake is complete — generate your plan to get next steps, checklists, and deadlines."
            : "Complete the guided intake first. Your answers drive the plan."
        }
        action={
          kase.intake.completed ? (
            <Button onClick={() => regeneratePlan(kase.id)}>
              <Sparkles className="h-4 w-4" />
              Generate action plan
            </Button>
          ) : (
            <Link href={`/cases/${kase.id}/intake`}>
              <Button>
                Start intake
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )
        }
      />
    );
  }

  const plan = kase.plan;
  const suggestedTemplate = plan.suggestedLetterTemplateId
    ? nav?.letterTemplates.find((t) => t.id === plan.suggestedLetterTemplateId)
    : undefined;
  const pendingDeadlines = [...kase.deadlines].sort((a, b) => a.date.localeCompare(b.date));
  const requiredDocs = kase.documents.filter((d) => d.required);
  const jurisdictionRules = rulesForCase(kase.navigatorSlug, kase.intake.answers.state);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Summary */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Your situation
            </CardTitle>
            <PriorityBadge priority={plan.priority} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-muted-foreground">{plan.situationSummary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Generated {formatDateTime(plan.generatedAt)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => regeneratePlan(kase.id)}
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate from current answers
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next 3 actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="h-4 w-4 text-primary" />
            Your next {plan.nextActions.length} actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.nextActions.map((action, i) => (
            <div key={action.title} className="flex gap-4 rounded-lg border border-border bg-card/50 p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {i + 1}
              </div>
              <div>
                <p className="font-medium leading-snug">{action.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Risk flags */}
      {plan.riskFlags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Risk flags</h2>
          {plan.riskFlags.map((flag) => (
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
            <p className="py-2 text-sm text-muted-foreground">No deadlines flagged for this case.</p>
          ) : (
            <>
              <p className="pb-1 text-xs text-muted-foreground">
                These are estimates from your answers — verify each against official notices, then check it off.
              </p>
              {pendingDeadlines.map((d) => (
                <DeadlineCard
                  key={d.id}
                  deadline={d}
                  onToggleVerified={() => toggleDeadlineVerified(kase.id, d.id)}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Docs + letter shortcuts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Document checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {requiredDocs.length} required document{requiredDocs.length === 1 ? "" : "s"},{" "}
              {kase.documents.length} total on your checklist.
            </p>
            <Link href={`/cases/${kase.id}/documents`} className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                Open checklist
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePen className="h-4 w-4 text-primary" />
              Suggested letter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {suggestedTemplate
                ? `Based on your answers: ${suggestedTemplate.name}.`
                : "Letter templates are available for this navigator."}
            </p>
            <Link href={`/cases/${kase.id}/letters`} className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                Open letter generator
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Jurisdiction-specific process notes */}
      {jurisdictionRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jurisdiction notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jurisdictionRules.map((rule) => (
              <details key={rule.id} className="group rounded-lg border border-border bg-card/50 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{rule.title}</span>
                    <span className="text-xs text-muted-foreground">{rule.state} · {rule.category}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{rule.summary}</p>
                </summary>
                <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
                  {rule.deadlineDetail && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{rule.deadlineType}: </span>
                      {rule.deadlineDetail}
                    </p>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Common process steps</p>
                    <ol className="mt-1.5 list-inside list-decimal space-y-1 text-muted-foreground">
                      {rule.processSteps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {rule.officialLinks.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2">
                        {l.label} ↗
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/80">
                    {rule.disclaimer} Last updated {formatDate(rule.lastUpdated)}.
                  </p>
                </div>
              </details>
            ))}
            <p className="text-xs text-muted-foreground">
              Sample jurisdiction data — expand a note for steps and official links. Always verify with the agency listed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <Callout variant="info" title="Important">
        {plan.disclaimer}
      </Callout>

      <div className="flex justify-center pb-4">
        <Link href={`/cases/${kase.id}`}>
          <Button size="lg">
            <ClipboardList className="h-4 w-4" />
            Go to case command center
          </Button>
        </Link>
      </div>
    </div>
  );
}
