import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
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
import { todayUtc } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Download everything Building202 holds about the signed-in account as one JSON
 * file. Only the caller's own rows — an admin gets their own account's data
 * here, not customers'. Excluded by design: the password hash and MFA secret
 * (credentials, not personal data to hand back), staff-only internal notes,
 * and Stripe's identifiers.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // An export reads the whole account; keep it from being used as a scraper.
  if (!(await rateLimit(`export:${user.id}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many export requests. Try again in a few minutes." }, { status: 429 });
  }

  const mine = { userId: user.id };
  const [cases, tickets, reviews, files, entitlements, purchases, acceptances, notifications] = await Promise.all([
    prisma.case.findMany({ where: mine, include: caseInclude, orderBy: { createdAt: "asc" } }),
    prisma.supportTicket.findMany({ where: mine, include: ticketInclude, orderBy: { createdAt: "asc" } }),
    prisma.reviewRequest.findMany({ where: mine, include: reviewInclude }),
    prisma.uploadedFile.findMany({ where: mine }),
    prisma.entitlement.findMany({ where: mine }),
    prisma.purchase.findMany({ where: mine, orderBy: { createdAt: "asc" } }),
    prisma.disclaimerAcceptance.findMany({ where: mine, orderBy: { acceptedAt: "asc" } }),
    prisma.notificationEvent.findMany({ where: mine, orderBy: { createdAt: "asc" } }),
  ]);

  const { passwordHash: _omit, ...profile } = userToDomain(user);
  void _omit;

  const body = {
    export: {
      service: "Building202",
      generatedAt: new Date().toISOString(),
      format: 1,
      note: "Everything Building202 stores about this account. Passwords and two-factor secrets are never exported. Building202 does not store uploaded documents.",
    },
    profile,
    cases: cases.map((c) => caseToDomain(c, { includeAdminNotes: false })),
    supportTickets: tickets.map((t) => ticketToDomain(t, { includeInternalNotes: false })),
    reviewRequests: reviews.map(reviewToDomain),
    fileRecords: files.map(fileToDomain),
    casePasses: entitlements.map(entitlementToDomain),
    purchases: purchases.map(purchaseToDomain),
    termsAcceptances: acceptances.map(acceptanceToDomain),
    notifications: notifications.map(notificationToDomain),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="building202-export-${todayUtc()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
