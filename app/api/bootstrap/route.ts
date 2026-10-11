import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { auditToDomain } from "@/lib/server/audit";
import { capabilities } from "@/lib/server/commerce";
import {
  acceptanceToDomain,
  caseInclude,
  caseToDomain,
  entitlementToDomain,
  fileToDomain,
  notificationToDomain,
  purchaseToDomain,
  reviewInclude,
  reviewToDomain,
  ticketInclude,
  ticketToDomain,
  userToDomain,
} from "@/lib/server/serializers";

/**
 * Session-scoped data load for the client store.
 *
 * Customers receive ONLY their own rows, with staff-only fields stripped
 * (case admin notes, ticket internal notes). Admins receive all customers'
 * cases/tickets/reviews/files plus the user directory (passwordHash is never
 * serialized for anyone).
 *
 * `capabilities` tells the UI what this deployment can really do (payments
 * live/test/off, email delivery, human review) so nothing unconfigured is
 * presented as working. Entitlements are informational for the UI — every
 * paid action is re-checked on the server.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const isAdmin = user.role === "admin";

  const ownerScope = isAdmin ? {} : { userId: user.id };

  const [users, cases, tickets, reviews, files, entitlements, purchases, acceptances, notifications, auditLog] =
    await Promise.all([
      isAdmin
        ? prisma.user.findMany({ include: { notificationPrefs: true } })
        : prisma.user.findMany({ where: { id: user.id }, include: { notificationPrefs: true } }),
      prisma.case.findMany({ where: ownerScope, include: caseInclude, orderBy: { updatedAt: "desc" } }),
      prisma.supportTicket.findMany({ where: ownerScope, include: ticketInclude, orderBy: { updatedAt: "desc" } }),
      prisma.reviewRequest.findMany({ where: ownerScope, include: reviewInclude, orderBy: { updatedAt: "desc" } }),
      prisma.uploadedFile.findMany({ where: ownerScope, orderBy: { uploadedAt: "desc" } }),
      prisma.entitlement.findMany({ where: ownerScope }),
      prisma.purchase.findMany({ where: ownerScope, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.disclaimerAcceptance.findMany({ where: { userId: user.id } }),
      prisma.notificationEvent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // Audit trail is staff-only, read-only.
      isAdmin
        ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
        : Promise.resolve([]),
    ]);

  return NextResponse.json({
    sessionUserId: user.id,
    users: users.map(userToDomain),
    cases: cases.map((c) => caseToDomain(c, { includeAdminNotes: isAdmin })),
    tickets: tickets.map((t) => ticketToDomain(t, { includeInternalNotes: isAdmin })),
    reviews: reviews.map(reviewToDomain),
    files: files.map(fileToDomain),
    entitlements: entitlements.map(entitlementToDomain),
    purchases: purchases.map(purchaseToDomain),
    acceptances: acceptances.map(acceptanceToDomain),
    notifications: notifications.map(notificationToDomain),
    auditLog: auditLog.map(auditToDomain),
    capabilities: capabilities(),
  });
}
