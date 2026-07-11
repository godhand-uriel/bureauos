import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { reviewInclude, reviewToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { reviewActionSchema } from "@/lib/schemas";
import type { NotificationEvent } from "@/lib/types";

/** Review workflow management — staff only. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("Staff only.");
  const { id } = await ctx.params;

  const parsed = reviewActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const action = parsed.data;

  const review = await prisma.reviewRequest.findUnique({ where: { id } });
  if (!review) return notFound("Review request not found.");

  const notifications: NotificationEvent[] = [];

  if (action.type === "set_status") {
    await prisma.reviewRequest.update({
      where: { id },
      data: { status: action.status, updatedAt: new Date() },
    });
    const kase = await prisma.case.findUnique({ where: { id: review.caseId } });
    notifications.push(
      ...(await queueNotification(
        review.userId,
        "review_update",
        `Review ${action.status.replace(/_/g, " ")}: ${kase?.title ?? "your case"}`,
        "Your professional review status was updated.",
      )),
    );
  } else {
    await prisma.$transaction([
      prisma.adminNote.create({
        data: { id: action.id, reviewId: id, authorName: user.name, body: action.body },
      }),
      prisma.reviewRequest.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
  }

  const updated = await prisma.reviewRequest.findUniqueOrThrow({ where: { id }, include: reviewInclude });
  return NextResponse.json({ review: reviewToDomain(updated), notifications });
}
