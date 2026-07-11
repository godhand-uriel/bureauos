import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser, notFound, unauthorized } from "@/lib/server/auth";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const kase = await prisma.case.findUnique({ where: { id } });
  if (!kase || (user.role !== "admin" && kase.userId !== user.id)) return notFound("Case not found.");

  // Files/reviews/notes cascade from the case; tickets keep their thread with caseId nulled.
  await prisma.case.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
