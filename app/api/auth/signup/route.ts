import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/passwords";
import { queueNotification } from "@/lib/server/notify";
import { signupInputSchema } from "@/lib/schemas";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/constants";

/**
 * Account creation. Does NOT establish a session — the client signs in
 * through Auth.js (CSRF-protected credentials flow) immediately after.
 * Rate-limited by the middleware (auth bucket).
 */
export async function POST(request: Request) {
  const parsed = signupInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { name, email, password, usState } = parsed.data;
  const normalized = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists. Try logging in." },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normalized,
      passwordHash: hashPassword(password),
      role: "customer", // roles are never client-assignable
      usState,
      notificationPrefs: { create: { ...DEFAULT_NOTIFICATION_PREFS } },
    },
  });
  await queueNotification(user.id, "welcome", "Welcome to BureauOS", "Your account is set up. Start a case any time.");

  return NextResponse.json({ ok: true });
}
