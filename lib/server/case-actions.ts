import { prisma } from "@/lib/server/db";
import type { SessionUser } from "@/lib/server/auth";
import { caseInclude, caseToDomain, type DbCase } from "@/lib/server/serializers";
import { writeAudit } from "@/lib/server/audit";
import { queueNotification } from "@/lib/server/notify";
import { generatePlanForCase } from "@/lib/plan-engine";
import { DISCLAIMER_VERSION } from "@/lib/constants";
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
const ADMIN_ONLY = new Set(["assign", "add_admin_note", "set_tier"]);

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
              detail: actorIsStaff ? "Updated by BureauOS staff." : null,
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
            `Status changed to ${action.status.replace(/_/g, " ")} by the BureauOS team.`,
          )),
        );
        await writeAudit(user, "case.set_status", "case", caseId, `${existing.status} → ${action.status}`, caseId);
      }
      break;
    }

    case "set_tier":
      // Staff override only (ADMIN_ONLY above) — always audited.
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
      const completed: Case = {
        ...domain,
        status: "planning",
        updatedAt: now.toISOString(),
        intake: { ...domain.intake, completed: true },
        timeline: [
          ...domain.timeline,
          {
            id: `intake-${caseId}`,
            type: "intake_completed",
            title: "Intake completed",
            detail: "All intake questions answered.",
            date: now.toISOString(),
          },
        ],
      };
      await persistEngineResult(existing, generatePlanForCase(completed), {
        intakeCompleted: true,
      });
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

    case "save_letter": {
      if (!isAdmin && !(await hasCaseAcceptance(existing.userId, caseId))) {
        return {
          ok: false,
          status: 403,
          error: "Terms, privacy, and disclaimer acceptance is required for this case first.",
        };
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
  const newDeadlines = after.deadlines.filter((d) => !beforeIds.deadlines.has(d.id));
  const newTimeline = after.timeline.filter((e) => !beforeIds.timeline.has(e.id));

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
    prisma.deadline.createMany({
      data: newDeadlines.map((d) => ({
        id: d.id,
        caseId: after.id,
        title: d.title,
        date: new Date(d.date),
        note: d.note ?? null,
        verified: d.verified,
      })),
    }),
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
