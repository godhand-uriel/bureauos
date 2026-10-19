import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser, notFound, unauthorized } from "@/lib/server/auth";

/** File review is gone with uploads (see ../route.ts). */
export async function PATCH() {
  return NextResponse.json({ error: "File uploads are not available." }, { status: 410 });
}

/**
 * Remove a legacy file-metadata row (name/size recorded by an earlier
 * version; no file content was ever stored). Owner or staff. Kept so those
 * rows stay deletable individually — they also go with their case or account.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file || (user.role !== "admin" && file.userId !== user.id)) return notFound("File not found.");

  await prisma.uploadedFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
