import { getNavigator } from "@/lib/navigators";
import type {
  ActionPlan,
  Case,
  Deadline,
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
 * deadlines, and timeline entries. Pure function — the store applies it.
 */
export function generatePlanForCase(kase: Case): Case {
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

  const existingDeadlineTitles = new Set(kase.deadlines.map((d) => d.title));
  const newDeadlines: Deadline[] = result.deadlines
    .filter((d) => !existingDeadlineTitles.has(d.title))
    .map((d) => ({
      id: uid(),
      title: d.title,
      date: daysFromNow(d.inDays),
      note: d.note,
      verified: false,
    }));

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
    deadlines: [...kase.deadlines, ...newDeadlines],
    timeline: [...kase.timeline, ...timelineEntries],
    updatedAt: now,
  };
}

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
export function nextActionFor(kase: Case): { title: string; detail: string; href: string } {
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
  const overdue = kase.deadlines
    .filter((d) => new Date(d.date).getTime() < Date.now() && !d.verified)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (overdue) {
    return {
      title: `Verify: ${overdue.title}`,
      detail: overdue.note || "This deadline has passed or needs verification.",
      href: `/cases/${kase.id}`,
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
