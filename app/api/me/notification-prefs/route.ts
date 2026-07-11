import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { userToDomain } from "@/lib/server/serializers";
import { prefsUpdateSchema } from "@/lib/schemas";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/constants";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = prefsUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...DEFAULT_NOTIFICATION_PREFS, ...parsed.data },
    update: parsed.data,
  });
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { notificationPrefs: true },
  });
  return NextResponse.json({ user: userToDomain(updated) });
}
