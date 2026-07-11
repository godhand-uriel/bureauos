import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { fileToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { fileUpdateInputSchema } from "@/lib/schemas";
import type { NotificationEvent } from "@/lib/types";

/** Verification status updates — staff only. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("Staff only.");
  const { id } = await ctx.params;

  const parsed = fileUpdateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) return notFound("File not found.");

  const updated = await prisma.uploadedFile.update({
    where: { id },
    data: { status: parsed.data.status, ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }) },
  });

  const notifications: NotificationEvent[] = [];
  if (parsed.data.status === "rejected") {
    notifications.push(
      ...(await queueNotification(
        file.userId,
        "missing_document",
        `Action needed: ${file.name}`,
        "A file on your case needs to be re-uploaded or replaced. Check the document checklist.",
      )),
    );
  }
  return NextResponse.json({ file: fileToDomain(updated), notifications });
}

/** Remove file metadata — owner or staff. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file || (user.role !== "admin" && file.userId !== user.id)) return notFound("File not found.");

  await prisma.uploadedFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
