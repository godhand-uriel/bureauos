import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { caseInclude, caseToDomain } from "@/lib/server/serializers";
import { createCaseInputSchema } from "@/lib/schemas";
import { getNavigator } from "@/lib/navigators";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createCaseInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { navigatorSlug, title } = parsed.data;
  const nav = getNavigator(navigatorSlug);

  // New cases inherit the owner's active service tier (server-derived).
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const serviceTier = sub?.status === "active" ? sub.tier : "self_service";

  const created = await prisma.case.create({
    data: {
      userId: user.id,
      navigatorSlug,
      title: title || `${nav?.shortName ?? "New"} case`,
      status: "intake",
      priority: "medium",
      serviceTier,
      timeline: {
        create: {
          type: "case_created",
          title: "Case created",
          detail: `Started in the ${nav?.name ?? "navigator"}.`,
        },
      },
    },
    include: caseInclude,
  });

  return NextResponse.json({
    case: caseToDomain(created, { includeAdminNotes: user.role === "admin" }),
  });
}
