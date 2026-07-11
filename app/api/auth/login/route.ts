import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { createSession, setSessionCookie, badRequest } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/passwords";
import { userToDomain } from "@/lib/server/serializers";
import { loginInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = loginInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { notificationPrefs: true },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({ user: userToDomain(user) });
  setSessionCookie(res, token);
  return res;
}
