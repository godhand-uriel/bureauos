import { getNavigator } from "@/lib/navigators";
import { computeRuleDeadline, explainCalculation, getDeadlineRule } from "@/lib/deadline-rules";
import { addDays, daysFromToday, parseDateOnly, todayLocal, todayUtc, type DateOnly } from "@/lib/dates";
import type {
  ActionPlan,
  AnswerValue,
  Case,
  Deadline,
  DeadlineSpec,
  DocumentRequirement,
  Task,
  TimelineEvent,
} from "@/lib/types";
import { daysFromNow, uid } from "@/lib/utils";

/**
 * Rule-based action plan engine.
 *
 * Takes a case with completed intake answers, runs the navigator's rule
 * logic, and returns the fully-updated case: plan, merged tasks/documents,
 * deadlines, and timeline entries. Pure function — the server applies it.
 */
export function generatePlanForCase(kase: Case, today: DateOnly = todayUtc()): Case {
  const nav = getNavigator(kase.navigatorSlug);
  if (!nav) return kase;

  const now = new Date().toISOString();
  const result = nav.buildPlan(kase.intake.answers);

  const plan: ActionPlan = {
    generatedAt: now,
    situationSummary: result.situationSummary,
    priority: result.priority,
    nextActions: result.nextActions,
    riskFlags: result.riskFlags.map((r) => ({ ...r, id: uid() })),
    suggestedLetterTemplateId: result.suggestedLetterTemplateId,
    disclaimer: nav.disclaimer,
  };

  // Merge base + rule-generated tasks, skipping any the user already has.
  // Task dates are suggested targets, not deadlines.
  const existingTaskTitles = new Set(kase.tasks.map((t) => t.title));
  const newTasks: Task[] = [...nav.baseTasks, ...result.extraTasks]
    .filter((t) => !existingTaskTitles.has(t.title))
    .map((t) => ({
      id: uid(),
      title: t.title,
      description: t.description,
      category: t.category,
      done: false,
      dueDate: t.dueInDays !== undefined ? daysFromNow(t.dueInDays) : undefined,
      createdAt: now,
    }));

  const existingDocNames = new Set(kase.documents.map((d) => d.name));
  const newDocs: DocumentRequirement[] = [...nav.baseDocuments, ...result.extraDocuments]
    .filter((d) => !existingDocNames.has(d.name))
    .map((d) => ({
      id: uid(),
      name: d.name,
      description: d.description,
      required: d.required,
      status: "needed" as const,
    }));

  const built = result.deadlines
    .map((spec) => buildDeadline(spec, kase.intake.answers, today))
    .filter((d): d is BuiltDeadline => d !== null);
  const deadlines = mergeDeadlines(kase.deadlines, built);

  const timelineEntries: TimelineEvent[] = result.timelineEntries.map((e) => ({
    id: uid(),
    type: "plan_generated" as const,
    title: e.title,
    detail: e.detail,
    date: now,
  }));

  return {
    ...kase,
    status: kase.status === "intake" || kase.status === "planning" ? "in_progress" : kase.status,
    priority: result.priority,
    plan,
    tasks: [...kase.tasks, ...newTasks],
    documents: [...kase.documents, ...newDocs],
    deadlines,
    timeline: [...kase.timeline, ...timelineEntries],
    updatedAt: now,
  };
}

/* ------------------------------ deadlines ------------------------------ */

export type BuiltDeadline = Omit<Deadline, "id" | "verified">;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Turn a navigator's deadline request into a tracked deadline.
 *
 * The invariant this function protects: an `official` deadline gets a date
 * ONLY from computeRuleDeadline — a source-checked rule applied to a trigger
 * date the user supplied. There is no code path that gives an official
 * deadline an estimated, relative-to-today, or default date.
 */
export function buildDeadline(
  spec: DeadlineSpec,
  answers: Record<string, AnswerValue>,
  today: DateOnly,
): BuiltDeadline | null {
  switch (spec.kind) {
    case "suggested":
      return {
        key: `suggested:${slug(spec.title)}`,
        title: spec.title,
        kind: "suggested",
        date: addDays(today, spec.inDays),
        note: spec.note,
      };

    case "self_reported": {
      if (!parseDateOnly(spec.date)) return null; // nothing reported → nothing to track
      return {
        key: `reported:${slug(spec.title)}`,
        title: spec.title,
        kind: "self_reported",
        date: (spec.date as string).trim(),
        note: spec.note,
      };
    }

    case "official": {
      const rule = getDeadlineRule(spec.ruleId);
      if (!rule) return null;
      const computed = computeRuleDeadline(rule, answers, today);
      const source = {
        ruleId: rule.id,
        jurisdiction: rule.jurisdiction.name,
        ruleSummary: rule.ruleSummary,
        citation: rule.citation,
        url: rule.sourceUrl,
        references: rule.references,
        checkedOn: rule.sourceCheckedOn,
        caveats: rule.caveats,
      };
      if (computed.status === "calculated") {
        return {
          key: `rule:${rule.id}`,
          title: rule.title,
          kind: "official",
          date: computed.date,
          note: spec.note ?? explainCalculation(rule, computed),
          source,
          trigger: {
            questionId: computed.basis.questionId,
            label: computed.basis.label,
            date: computed.basis.date,
            mayBeFuture: rule.triggers.find((t) => t.questionId === computed.basis.questionId)!.mayBeFuture,
          },
        };
      }
      return {
        key: `rule:${rule.id}`,
        title: rule.title,
        kind: "official",
        date: null,
        note: computed.reason,
        source,
        // Ask for the first date still missing — for a two-date rule, the
        // other one may already be recorded.
        trigger: {
          questionId: computed.missing.questionId,
          label: computed.missing.label,
          date: null,
          mayBeFuture: computed.missing.mayBeFuture,
        },
      };
    }

    case "official_unavailable":
      return {
        key: `unavailable:${slug(spec.key)}`,
        title: spec.title,
        kind: "official",
        date: null,
        note: spec.note,
      };
  }
}

/**
 * Reconcile freshly built deadlines with what the case already tracks.
 *  - same key → updated in place (keeps its id); `verified` survives only if
 *    the date is unchanged
 *  - suggested targets that already exist keep their original date (they
 *    must not slide forward every time the plan is regenerated)
 *  - official / self-reported deadlines the rules no longer produce (the
 *    answers changed) are dropped; suggested ones are kept
 */
export function mergeDeadlines(existing: Deadline[], built: BuiltDeadline[]): Deadline[] {
  const matched = new Set<string>();
  const merged: Deadline[] = built.map((b) => {
    const prev =
      existing.find((e) => e.key && e.key === b.key) ??
      existing.find((e) => !e.key && e.title === b.title);
    if (!prev) return { ...b, id: uid(), verified: false };
    matched.add(prev.id);
    if (b.kind === "suggested") {
      return { ...prev, key: b.key, kind: "suggested", note: b.note ?? prev.note };
    }
    return { ...b, id: prev.id, verified: prev.date === b.date ? prev.verified : false };
  });
  const carried = existing.filter((e) => !matched.has(e.id) && e.kind === "suggested");
  return [...merged, ...carried];
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Dated deadlines first (soonest first), then the ones still awaiting a date. */
export function sortDeadlines<T extends { date: string | null }>(deadlines: T[]): T[] {
  return [...deadlines].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

/**
 * The one deadline worth surfacing on a compact card: the soonest upcoming
 * official / notice date, else an official deadline still awaiting a date,
 * else the soonest open suggested follow-up.
 */
export function headlineDeadline(deadlines: Deadline[], today: DateOnly = todayLocal()): Deadline | undefined {
  const upcoming = (d: Deadline) => d.date !== null && daysFromToday(d.date, today) >= 0;
  return (
    sortDeadlines(deadlines.filter((d) => d.kind !== "suggested" && upcoming(d)))[0] ??
    deadlines.find((d) => d.kind === "official" && d.date === null) ??
    sortDeadlines(deadlines.filter((d) => d.kind === "suggested" && !d.verified && upcoming(d)))[0]
  );
}

/* ------------------------------ selectors ------------------------------ */

/** Overall case progress: intake 20%, tasks 50%, documents 30%. */
export function caseProgress(kase: Case): number {
  const intakePart = kase.intake.completed ? 20 : 0;
  const taskPart =
    kase.tasks.length === 0
      ? 0
      : (kase.tasks.filter((t) => t.done).length / kase.tasks.length) * 50;
  const relevantDocs = kase.documents.filter((d) => d.status !== "not_applicable");
  const docPart =
    relevantDocs.length === 0
      ? 0
      : (relevantDocs.filter((d) => d.status === "obtained").length / relevantDocs.length) * 30;
  return Math.round(intakePart + taskPart + docPart);
}

/** The single most useful next step for a case, for dashboards and headers. */
export function nextActionFor(
  kase: Case,
  today: DateOnly = todayLocal(),
): { title: string; detail: string; href: string } {
  if (!kase.intake.completed) {
    return {
      title: "Complete your intake",
      detail: "Answer the guided questions to unlock your personalized action plan.",
      href: `/cases/${kase.id}/intake`,
    };
  }
  if (!kase.plan) {
    return {
      title: "Generate your action plan",
      detail: "Intake is done — generate the plan to get next steps and checklists.",
      href: `/cases/${kase.id}/plan`,
    };
  }

  // 1 — a dated official / notice deadline coming up in the next two weeks
  const upcoming = sortDeadlines(
    kase.deadlines.filter((d) => {
      if (d.kind === "suggested" || !d.date) return false;
      const days = daysFromToday(d.date, today);
      return days >= 0 && days <= 14;
    }),
  )[0];
  if (upcoming?.date) {
    const days = daysFromToday(upcoming.date, today);
    return {
      title: `${days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`}: ${upcoming.title}`,
      detail: upcoming.verified
        ? "You confirmed this date against your notice."
        : "Confirm this date against your official notice, then act before it.",
      href: `/cases/${kase.id}/plan`,
    };
  }

  // 2 — an official deadline that could not be established
  const unverified = kase.deadlines.find((d) => d.kind === "official" && !d.date);
  if (unverified) {
    return {
      title: `Needs verification: ${unverified.title}`,
      detail: unverified.trigger
        ? `Add the ${lowerFirst(unverified.trigger.label)} so this deadline can be calculated.`
        : "Find this deadline on your official notice — BureauOS could not establish it.",
      href: `/cases/${kase.id}/plan`,
    };
  }

  const nextTask = kase.tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))[0];
  if (nextTask) {
    return {
      title: nextTask.title,
      detail: nextTask.description || "Next open task on your checklist.",
      href: `/cases/${kase.id}`,
    };
  }
  const neededDoc = kase.documents.find((d) => d.status === "needed" && d.required);
  if (neededDoc) {
    return {
      title: `Obtain: ${neededDoc.name}`,
      detail: neededDoc.description || "Required document still outstanding.",
      href: `/cases/${kase.id}/documents`,
    };
  }
  return {
    title: "Review and close out",
    detail: "All tasks and documents are handled. Review the case and mark it resolved.",
    href: `/cases/${kase.id}`,
  };
}
