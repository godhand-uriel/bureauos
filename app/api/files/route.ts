import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { caseInclude, caseToDomain, fileToDomain } from "@/lib/server/serializers";
import { createFileInputSchema } from "@/lib/schemas";

/**
 * File METADATA only (Phase 1): name/type/size/category/notes. File bytes
 * never reach the server — real storage (S3/Supabase) is a later phase.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createFileInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { id, caseId, name, fileType, sizeLabel, category, notes } = parsed.data;

  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || (user.role !== "admin" && kase.userId !== user.id)) return notFound("Case not found.");

  const now = new Date();
  const [file] = await prisma.$transaction([
    prisma.uploadedFile.create({
      data: {
        id,
        caseId,
        userId: kase.userId,
        name,
        fileType,
        sizeLabel,
        category,
        notes,
        status: "pending_review",
        uploadedAt: now,
      },
    }),
    prisma.case.update({
      where: { id: caseId },
      data: {
        updatedAt: now,
        timeline: {
          create: { type: "document_update", title: `File attached: ${name}`, detail: "Awaiting review by the BureauOS team.", date: now },
        },
      },
    }),
  ]);

  const updatedCase = await prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: caseInclude });
  return NextResponse.json({
    file: fileToDomain(file),
    case: caseToDomain(updatedCase, { includeAdminNotes: user.role === "admin" }),
    notifications: [],
  });
}
