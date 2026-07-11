import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { acceptanceToDomain } from "@/lib/server/serializers";
import { acceptanceInputSchema } from "@/lib/schemas";
import { DISCLAIMER_VERSION } from "@/lib/constants";

/** Records a versioned terms/privacy/disclaimer acceptance (optionally case-linked). */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = acceptanceInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { id, caseId } = parsed.data;

  // A case-linked acceptance must reference a case the user can actually access.
  if (caseId) {
    const kase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!kase || (user.role !== "admin" && kase.userId !== user.id)) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
  }

  const acceptance = await prisma.disclaimerAcceptance.create({
    data: {
      id,
      userId: user.id,
      caseId,
      version: DISCLAIMER_VERSION,
      acceptedTerms: true,
      acceptedPrivacy: true,
      acceptedDisclaimer: true,
    },
  });
  return NextResponse.json({ acceptance: acceptanceToDomain(acceptance) });
}
