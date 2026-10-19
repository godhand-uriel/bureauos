import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { caseInclude, caseToDomain, reviewInclude, reviewToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { humanReviewEnabled } from "@/lib/server/commerce";
import { createReviewInputSchema } from "@/lib/schemas";
import { tierIncludesReview } from "@/lib/packages";
import { DISCLAIMER_VERSION } from "@/lib/constants";
import type { ServiceTierId } from "@/lib/types";

/**
 * Professional review requests. Server-enforced: the requester must own the
 * case, the case's service tier must include review, and the per-case
 * disclaimer acceptance must be on record.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Human review is a staffed service. Unless operations has switched it on,
  // no request can be created — the queue must never fill with requests that
  // nobody is contracted to answer.
  if (!humanReviewEnabled()) {
    return NextResponse.json({ error: "Professional review is not currently offered." }, { status: 409 });
  }

  const parsed = createReviewInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { caseId, customerNotes } = parsed.data;

  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || (user.role !== "admin" && kase.userId !== user.id)) return notFound("Case not found.");
  if (!tierIncludesReview(kase.serviceTier as ServiceTierId)) {
    return forbidden("Professional review is included from the Assisted Review package up.");
  }
  const accepted = await prisma.disclaimerAcceptance.count({
    where: { userId: kase.userId, caseId: kase.id, version: DISCLAIMER_VERSION },
  });
  if (accepted === 0) {
    return forbidden("Terms, privacy, and disclaimer acceptance is required for this case first.");
  }

  const now = new Date();
  const review = await prisma.reviewRequest.upsert({
    where: { caseId },
    create: { caseId, userId: kase.userId, status: "requested", customerNotes, requestedAt: now },
    update: { status: "requested", customerNotes, updatedAt: now },
    include: reviewInclude,
  });
  await prisma.case.update({
    where: { id: caseId },
    data: {
      updatedAt: now,
      timeline: {
        create: { type: "note", title: "Professional review requested", detail: "Your case file was submitted for review.", date: now },
      },
    },
  });

  const notifications = await queueNotification(
    kase.userId,
    "review_update",
    `Review requested: ${kase.title}`,
    "Your case file is in the review queue. You'll be notified as the status changes.",
  );

  const updatedCase = await prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: caseInclude });
  return NextResponse.json({
    review: reviewToDomain(review),
    case: caseToDomain(updatedCase, { includeAdminNotes: user.role === "admin" }),
    notifications,
  });
}
