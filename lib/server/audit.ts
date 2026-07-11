import { prisma } from "@/lib/server/db";
import type { SessionUser } from "@/lib/server/auth";
import type { AuditEntry } from "@/lib/types";

/**
 * Append-only audit trail for staff actions.
 *
 * Written server-side only, alongside the mutation it records (never from
 * client input). The app exposes it read-only to admin sessions and provides
 * no update/delete path. Failures are logged but never block the underlying
 * mutation — an audit hiccup must not take down case work.
 */
export async function writeAudit(
  actor: SessionUser,
  action: string,
  targetType: "case" | "ticket" | "review" | "file" | "system",
  targetId: string,
  detail: string,
  caseId?: string | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        targetType,
        targetId,
        caseId: caseId ?? null,
        detail,
      },
    });
  } catch (err) {
    console.error("[bureauos] audit write failed", { action, targetType, targetId }, err);
  }
}

export function auditToDomain(a: {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  caseId: string | null;
  detail: string;
  createdAt: Date;
}): AuditEntry {
  return {
    id: a.id,
    actorId: a.actorId,
    actorName: a.actorName,
    actorRole: a.actorRole as AuditEntry["actorRole"],
    action: a.action,
    targetType: a.targetType as AuditEntry["targetType"],
    targetId: a.targetId,
    caseId: a.caseId,
    detail: a.detail,
    createdAt: a.createdAt.toISOString(),
  };
}
