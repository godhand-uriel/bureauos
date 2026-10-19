import { prisma } from "@/lib/server/db";
import type { SessionUser } from "@/lib/server/auth";
import { caseInclude, caseToDomain, deadlineToRow, type DbCase } from "@/lib/server/serializers";
import { writeAudit } from "@/lib/server/audit";
import { queueNotification } from "@/lib/server/notify";
import { letterAccess } from "@/lib/server/letter-access";
import { hasCasePass, staffGrantCasePass, staffRevokeCasePass } from "@/lib/server/payments";
import { humanReviewEnabled } from "@/lib/server/commerce";
import { isPaidNavigator } from "@/lib/launch";
import { generatePlanForCase } from "@/lib/plan-engine";
import { getNavigator } from "@/lib/navigators";
import { DEADLINE_RULES } from "@/lib/deadline-rules";
import { addDays, compareDateOnly, parseDateOnly, todayUtc } from "@/lib/dates";
import { isAnswered, pruneHiddenAnswers, visibleQuestions } from "@/lib/intake";
import { DISCLAIMER_VERSION } from "@/lib/constants";
import { uid } from "@/lib/utils";
import type { CaseActionInput } from "@/lib/schemas";
import type { Case, NotificationEvent } from "@/lib/types";

/**
 * Executes one validated case mutation with server-side authorization.
 *
 * Rules enforced here (never trusted from the client):
 *  - customers may only touch cases they own; admins may touch any case
 *  - assign / add_admin_note are admin-only
 *  - the "staff" actor on status changes is derived from the session role
 *  - complete_intake and save_letter require a recorded per-case disclaimer
 *    acceptance for the current version
 */

export type CaseActionResult =
  | { ok: true; case: Case; notifications: NotificationEvent[] }
  | { ok: false; status: number; error: string };

/**
 * set_tier is staff-only: a case's service tier is an ENTITLEMENT. Customers
 * acquire entitlements exclusively through verified server-side payment state
 * (the Stripe webhook), never by asking this API to raise their own tier.
 */
const ADMIN_ONLY = new Set([
  "assign",
  "add_admin_note",
  "set_tier",
  "grant_case_pass",
  "revoke_case_pass",
]);

async function loadCase(id: string): Promise<DbCase | null> {
  return prisma.case.findUnique({ where: { id }, include: caseInclude });
}

async function hasCaseAcceptance(userId: string, caseId: string): Promise<boolean> {
  const count = await prisma.disclaimerAcceptance.count({
    where: { userId, caseId, version: DISCLAIMER_VERSION },
  });
  return count > 0;
}

export async function performCaseAction(
  user: SessionUser,
  caseId: string,
  action: CaseActionInput,
): Promise<CaseActionResult> {
  const isAdmin = user.role === "admin";
  const existing = await loadCase(caseId);
  if (!existing) return { ok: false, status: 404, error: "Case not found." };
  if (!isAdmin && existing.userId !== user.id) {
    // Same response as not-found so case ids can't be probed.
    return { ok: false, status: 404, error: "Case not found." };
  }
  if (ADMIN_ONLY.has(action.type) && !isAdmin) {
    return { ok: false, status: 403, error: "Staff only." };
  }

  const now = new Date();
  const notifications: NotificationEvent[] = [];
  const touch = prisma.case.update({ where: { id: caseId }, data: { updatedAt: now } });

  switch (action.type) {
    case "set_status": {
      const actorIsStaff = isAdmin && existing.userId !== user.id;
      await prisma.case.update({
        where: { id: caseId },
        data: {
          status: action.status,
          updatedAt: now,
          timeline: {
            create: {
              type: "status_change",
              title: `Status changed to ${action.status.replace(/_/g, " ")}`,
              detail: actorIsStaff ? "Updated by Building202 staff." : null,
              date: now,
            },
          },
        },
      });
      if (actorIsStaff) {
        notifications.push(
          ...(await queueNotification(
            existing.userId,
            "case_status",
            `Case update: ${existing.title}`,
            `Status changed to ${action.status.replace(/_/g, " ")} by the Building202 team.`,
          )),
        );
        await writeAudit(user, "case.set_status", "case", caseId, `${existing.status} → ${action.status}`, caseId);
      }
      break;
    }

    case "set_tier":
      // Staff override only (ADMIN_ONLY above) — always audited. The human-
      // assisted tiers cannot be applied unless that service is switched on.
      if (action.tier !== "self_service" && !humanReviewEnabled()) {
        return { ok: false, status: 409, error: "Human-assisted packages are not currently offered." };
      }
      await prisma.case.update({
        where: { id: caseId },
        data: { serviceTier: action.tier, updatedAt: now },
      });
      await writeAudit(user, "case.set_tier", "case", caseId, `${existing.serviceTier} → ${action.tier}`, caseId);
      break;

    case "assign":
      await prisma.case.update({
        where: { id: caseId },
        data: { assignedTo: action.staffName, updatedAt: now },
      });
      await writeAudit(user, "case.assign", "case", caseId, action.staffName ? `Assigned to ${action.staffName}` : "Unassigned", caseId);
      break;

    case "add_admin_note":
      await prisma.$transaction([
        prisma.adminNote.create({
          data: { id: action.id, caseId, authorName: user.name, body: action.body },
        }),
        touch,
      ]);
      await writeAudit(user, "case.add_internal_note", "case", caseId, "Internal note added", caseId);
      break;

    case "save_intake": {
      await prisma.$transaction([
        prisma.intakeAnswer.deleteMany({ where: { caseId } }),
        prisma.intakeAnswer.createMany({
          data: Object.entries(action.answers).map(([questionId, value]) => ({
            caseId,
            questionId,
            valueJson: JSON.stringify(value ?? null),
          })),
        }),
        prisma.case.update({
          where: { id: caseId },
          data: { intakeStep: action.step, updatedAt: now },
        }),
      ]);
      break;
    }

    case "complete_intake": {
      if (existing.intakeCompleted) break; // idempotent
      if (!(await hasCaseAcceptance(existing.userId, caseId))) {
        return {
          ok: false,
          status: 403,
          error: "Terms, privacy, and disclaimer acceptance is required for this case first.",
        };
      }
      const domain = caseToDomain(existing, { includeAdminNotes: true });
      const nav = getNavigator(existing.navigatorSlug);
      if (!nav) return { ok: false, status: 400, error: "Unknown navigator for this case." };

      // Answers on branches the user backed out of are stale — drop them
      // before any rule (especially a deadline rule) can read them.
      const answers = pruneHiddenAnswers(nav.questions, domain.intake.answers);
      const stale = Object.keys(domain.intake.answers).filter((k) => !(k in answers));
      if (stale.length > 0) {
        await prisma.intakeAnswer.deleteMany({ where: { caseId, questionId: { in: stale } } });
      }

      const missing = visibleQuestions(nav.questions, answers).filter(
        (q) => q.required && !isAnswered(q, answers[q.id]),
      );
      if (missing.length > 0) {
        return {
          ok: false,
          status: 400,
          error: `Intake is incomplete — still needed: ${missing.map((q) => q.label).join("; ")}`,
        };
      }

      const completed: Case = {
        ...domain,
        // A reopened intake keeps whatever status the case had reached.
        status: domain.status === "intake" ? "planning" : domain.status,
        updatedAt: now.toISOString(),
        intake: { ...domain.intake, answers, completed: true },
        timeline: [
          ...domain.timeline,
          {
            id: uid(),
            type: "intake_completed",
            title: domain.plan ? "Intake answers updated" : "Intake completed",
            detail: domain.plan ? "Plan and deadlines recalculated from the updated answers." : "All intake questions answered.",
            date: now.toISOString(),
          },
        ],
      };
      await persistEngineResult(existing, generatePlanForCase(completed), {
        intakeCompleted: true,
      });
      break;
    }

    case "reopen_intake": {
      if (!existing.intakeCompleted) break; // idempotent
      await prisma.case.update({
        where: { id: caseId },
        data: {
          intakeCompleted: false,
          intakeStep: 0,
          updatedAt: now,
          timeline: { create: { type: "note", title: "Intake reopened to update answers", date: now } },
        },
      });
      break;
    }

    case "set_trigger_date": {
      // Record the real triggering event for a deadline (e.g. the mailing
      // date printed on a notice), then recalculate. The date goes through
      // the same rule registry as intake — nothing is computed here.
      if (!existing.intakeCompleted) {
        return { ok: false, status: 409, error: "Complete the intake first." };
      }
      if (!isAdmin && !(await hasCaseAcceptance(existing.userId, caseId))) {
        return {
          ok: false,
          status: 403,
          error: "Terms, privacy, and disclaimer acceptance is required for this case first.",
        };
      }
      const nav = getNavigator(existing.navigatorSlug);
      const question = nav?.questions.find((q) => q.id === action.questionId && q.type === "date");
      if (!nav || !question) {
        return { ok: false, status: 400, error: "That date isn't part of this case's intake." };
      }
      if (!parseDateOnly(action.date)) {
        return { ok: false, status: 400, error: "Enter a real calendar date." };
      }
      const triggers = DEADLINE_RULES.filter((r) => r.navigatorSlug === existing.navigatorSlug).flatMap(
        (r) => r.triggers,
      );
      const trigger = triggers.find((t) => t.questionId === action.questionId);
      // One day of slack so a user slightly ahead of UTC can enter "today".
      if (trigger && !trigger.mayBeFuture && compareDateOnly(action.date, addDays(todayUtc(), 1)) > 0) {
        return {
          ok: false,
          status: 400,
          error: "That date is in the future. Enter the date printed on your notice.",
        };
      }

      const writes = [
        prisma.intakeAnswer.upsert({
          where: { caseId_questionId: { caseId, questionId: question.id } },
          create: { caseId, questionId: question.id, valueJson: JSON.stringify(action.date) },
          update: { valueJson: JSON.stringify(action.date) },
        }),
        prisma.timelineEvent.create({
          data: {
            caseId,
            type: "deadline",
            title: `Date recorded: ${trigger?.label ?? question.label}`,
            detail: action.date,
            date: now,
          },
        }),
      ];
      // "Have you received the notice?" must agree with having its date.
      if (question.showIf && typeof question.showIf.equals === "boolean") {
        const parentId = question.showIf.questionId;
        const parentValue = JSON.stringify(question.showIf.equals);
        writes.push(
          prisma.intakeAnswer.upsert({
            where: { caseId_questionId: { caseId, questionId: parentId } },
            create: { caseId, questionId: parentId, valueJson: parentValue },
            update: { valueJson: parentValue },
          }),
        );
      }
      await prisma.$transaction(writes);

      const refreshed = await loadCase(caseId);
      if (!refreshed) return { ok: false, status: 404, error: "Case not found." };
      await persistEngineResult(
        refreshed,
        generatePlanForCase(caseToDomain(refreshed, { includeAdminNotes: true })),
        {},
      );
      break;
    }

    case "regenerate_plan": {
      // A plan may only exist for a case whose intake was completed — which
      // itself required the per-case acceptance. Without this check a direct
      // API call could generate a plan while skipping both gates.
      if (!existing.intakeCompleted) {
        return { ok: false, status: 409, error: "Complete the intake before generating a plan." };
      }
      if (!isAdmin && !(await hasCaseAcceptance(existing.userId, caseId))) {
        return {
          ok: false,
          status: 403,
          error: "Terms, privacy, and disclaimer acceptance is required for this case first.",
        };
      }
      const domain = caseToDomain(existing, { includeAdminNotes: true });
      await persistEngineResult(existing, generatePlanForCase(domain), {});
      break;
    }

    case "toggle_task": {
      const task = existing.tasks.find((t) => t.id === action.taskId);
      if (!task) return { ok: false, status: 404, error: "Task not found." };
      const nowDone = !task.done;
      const ops = [
        prisma.task.update({ where: { id: task.id }, data: { done: nowDone } }),
        touch,
      ];
      if (nowDone) {
        ops.push(
          prisma.case.update({
            where: { id: caseId },
            data: {
              timeline: {
                create: { type: "task_completed", title: `Task completed: ${task.title}`, date: now },
              },
            },
          }),
        );
      }
      await prisma.$transaction(ops);
      break;
    }

    case "add_task":
      await prisma.$transaction([
        prisma.task.create({
          data: { id: action.id, caseId, title: action.title, category: "Custom", done: false, createdAt: now },
        }),
        touch,
      ]);
      break;

    case "set_document_status": {
      const doc = existing.documents.find((d) => d.id === action.docId);
      if (!doc) return { ok: false, status: 404, error: "Document not found." };
      const ops = [
        prisma.documentRequirement.update({ where: { id: doc.id }, data: { status: action.status } }),
        touch,
      ];
      if (action.status === "obtained") {
        ops.push(
          prisma.case.update({
            where: { id: caseId },
            data: {
              timeline: {
                create: { type: "document_update", title: `Document obtained: ${doc.name}`, date: now },
              },
            },
          }),
        );
      }
      await prisma.$transaction(ops);
      break;
    }

    case "toggle_deadline": {
      const deadline = existing.deadlines.find((d) => d.id === action.deadlineId);
      if (!deadline) return { ok: false, status: 404, error: "Deadline not found." };
      if (!deadline.date) {
        // There is no date to confirm — it has to be established first.
        return { ok: false, status: 409, error: "This deadline has no date to verify yet." };
      }
      await prisma.$transaction([
        prisma.deadline.update({ where: { id: deadline.id }, data: { verified: !deadline.verified } }),
        touch,
      ]);
      break;
    }

    case "add_timeline_event":
      await prisma.$transaction([
        prisma.timelineEvent.create({
          data: {
            id: action.id,
            caseId,
            type: action.eventType,
            title: action.title,
            detail: action.detail ?? null,
            date: now,
          },
        }),
        touch,
      ]);
      break;

    case "grant_case_pass": {
      // Staff override (ADMIN_ONLY above): unlock without a payment — e.g. a
      // goodwill grant or fixing a payment that needs manual reconciliation.
      if (!isPaidNavigator(existing.navigatorSlug)) {
        return { ok: false, status: 400, error: "No paid product is offered for this navigator." };
      }
      if (await hasCasePass(caseId)) {
        return { ok: false, status: 409, error: "This case already has a Case Pass." };
      }
      await staffGrantCasePass(caseId, existing.userId);
      await prisma.timelineEvent.create({
        data: { caseId, type: "note", title: "Case Pass granted by Building202 staff", date: now },
      });
      await writeAudit(user, "case.grant_case_pass", "case", caseId, `Staff grant: ${action.reason}`, caseId);
      break;
    }

    case "revoke_case_pass": {
      const revoked = await staffRevokeCasePass(caseId, `staff: ${action.reason}`);
      if (revoked === 0) {
        return { ok: false, status: 409, error: "This case has no active Case Pass." };
      }
      await prisma.timelineEvent.create({
        data: { caseId, type: "note", title: "Case Pass removed by Building202 staff", date: now },
      });
      await writeAudit(user, "case.revoke_case_pass", "case", caseId, `Staff revoke: ${action.reason}`, caseId);
      break;
    }

    case "save_letter": {
      // Same gate as the render endpoint: acceptance on record, and — in a
      // paid navigator — an active Case Pass on this case.
      const access = await letterAccess(user, existing);
      if (!access.ok) return access;
      if (!getNavigator(existing.navigatorSlug)?.letterTemplates.some((t) => t.id === action.templateId)) {
        return { ok: false, status: 400, error: "Unknown letter template for this case." };
      }
      await prisma.$transaction([
        prisma.generatedLetter.create({
          data: {
            id: action.id,
            caseId,
            templateId: action.templateId,
            title: action.title,
            body: action.letterBody,
            createdAt: now,
            updatedAt: now,
          },
        }),
        prisma.timelineEvent.create({
          data: { caseId, type: "letter_generated", title: `Letter saved: ${action.title}`, date: now },
        }),
        touch,
      ]);
      break;
    }

    case "update_letter": {
      const letter = existing.letters.find((l) => l.id === action.letterId);
      if (!letter) return { ok: false, status: 404, error: "Letter not found." };
      await prisma.$transaction([
        prisma.generatedLetter.update({
          where: { id: letter.id },
          data: { body: action.letterBody, updatedAt: now },
        }),
        touch,
      ]);
      break;
    }

    case "delete_letter": {
      const letter = existing.letters.find((l) => l.id === action.letterId);
      if (!letter) return { ok: false, status: 404, error: "Letter not found." };
      await prisma.$transaction([prisma.generatedLetter.delete({ where: { id: letter.id } }), touch]);
      break;
    }
  }

  const updated = await loadCase(caseId);
  if (!updated) return { ok: false, status: 404, error: "Case not found." };
  return {
    ok: true,
    case: caseToDomain(updated, { includeAdminNotes: isAdmin }),
    notifications,
  };
}

/**
 * Writes the output of the rule engine back to the database: updated case
 * scalars, upserted plan, and any tasks/documents/deadlines/timeline entries
 * the engine appended (identified by ids not present before the run).
 */
async function persistEngineResult(
  before: DbCase,
  after: Case,
  extra: { intakeCompleted?: boolean },
): Promise<void> {
  const beforeIds = {
    tasks: new Set(before.tasks.map((t) => t.id)),
    documents: new Set(before.documents.map((d) => d.id)),
    deadlines: new Set(before.deadlines.map((d) => d.id)),
    timeline: new Set(before.timeline.map((e) => e.id)),
  };
  const newTasks = after.tasks.filter((t) => !beforeIds.tasks.has(t.id));
  const newDocs = after.documents.filter((d) => !beforeIds.documents.has(d.id));
  const newTimeline = after.timeline.filter((e) => !beforeIds.timeline.has(e.id));

  // Deadlines are reconciled, not just appended: the engine updates existing
  // ones in place (a notice date was added → the deadline is now calculated)
  // and drops official/self-reported ones the answers no longer support.
  const afterDeadlineIds = new Set(after.deadlines.map((d) => d.id));
  const removedDeadlineIds = before.deadlines
    .filter((d) => !afterDeadlineIds.has(d.id))
    .map((d) => d.id);
  const deadlineWrites = after.deadlines.map((d) =>
    beforeIds.deadlines.has(d.id)
      ? prisma.deadline.update({ where: { id: d.id }, data: deadlineToRow(d) })
      : prisma.deadline.create({ data: { id: d.id, caseId: after.id, ...deadlineToRow(d) } }),
  );

  await prisma.$transaction([
    prisma.case.update({
      where: { id: after.id },
      data: {
        status: after.status,
        priority: after.priority,
        intakeCompleted: extra.intakeCompleted ?? before.intakeCompleted,
        updatedAt: new Date(),
      },
    }),
    prisma.actionPlan.upsert({
      where: { caseId: after.id },
      create: {
        caseId: after.id,
        generatedAt: new Date(after.plan!.generatedAt),
        situationSummary: after.plan!.situationSummary,
        priority: after.plan!.priority,
        nextActionsJson: JSON.stringify(after.plan!.nextActions),
        riskFlagsJson: JSON.stringify(after.plan!.riskFlags),
        suggestedLetterTemplateId: after.plan!.suggestedLetterTemplateId ?? null,
        disclaimer: after.plan!.disclaimer,
      },
      update: {
        generatedAt: new Date(after.plan!.generatedAt),
        situationSummary: after.plan!.situationSummary,
        priority: after.plan!.priority,
        nextActionsJson: JSON.stringify(after.plan!.nextActions),
        riskFlagsJson: JSON.stringify(after.plan!.riskFlags),
        suggestedLetterTemplateId: after.plan!.suggestedLetterTemplateId ?? null,
        disclaimer: after.plan!.disclaimer,
      },
    }),
    prisma.task.createMany({
      data: newTasks.map((t) => ({
        id: t.id,
        caseId: after.id,
        title: t.title,
        description: t.description ?? null,
        category: t.category ?? null,
        done: t.done,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        createdAt: new Date(t.createdAt),
      })),
    }),
    prisma.documentRequirement.createMany({
      data: newDocs.map((d) => ({
        id: d.id,
        caseId: after.id,
        name: d.name,
        description: d.description ?? null,
        required: d.required,
        status: d.status,
      })),
    }),
    prisma.deadline.deleteMany({ where: { id: { in: removedDeadlineIds } } }),
    ...deadlineWrites,
    prisma.timelineEvent.createMany({
      data: newTimeline.map((e) => ({
        id: e.id,
        caseId: after.id,
        type: e.type,
        title: e.title,
        detail: e.detail ?? null,
        date: new Date(e.date),
      })),
    }),
  ]);
}
