import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { userToDomain } from "@/lib/server/serializers";
import { profileUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { name, email, usState, phone } = parsed.data;

  if (email) {
    const taken = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), NOT: { id: user.id } },
    });
    if (taken) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email.toLowerCase() }),
      ...(usState !== undefined && { usState }),
      ...(phone !== undefined && { phone }),
    },
    include: { notificationPrefs: true },
  });
  return NextResponse.json({ user: userToDomain(updated) });
}
