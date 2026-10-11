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

  const created = await prisma.case.create({
    data: {
      userId: user.id,
      navigatorSlug,
      title: title || `${nav?.shortName ?? "New"} case`,
      status: "intake",
      priority: "medium",
      // Every case starts self-service. Paid access is a per-case entitlement
      // granted by verified payment (lib/server/payments.ts), never inherited.
      serviceTier: "self_service",
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
