import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { writeAudit } from "@/lib/server/audit";
import { cancelPendingCheckouts } from "@/lib/server/payments";

/**
 * Delete a case and everything in it (answers, plan, tasks, deadlines,
 * letters, timeline, notes, any Case Pass). Owner or staff. Support tickets
 * keep their thread with the case link nulled; purchase records are kept
 * with the case link nulled. A staff deletion of a customer's case is audited.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || (user.role !== "admin" && kase.userId !== user.id)) return notFound("Case not found.");

  await cancelPendingCheckouts({ caseId: id });
  await prisma.case.delete({ where: { id } });

  if (kase.userId !== user.id) {
    await writeAudit(user, "case.delete", "case", id, `Deleted a customer's ${kase.navigatorSlug} case`, null);
  }
  return NextResponse.json({ ok: true });
}
