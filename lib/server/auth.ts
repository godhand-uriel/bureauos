import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User as DbUser, NotificationPreference } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Demo-grade session auth: random token in an httpOnly cookie, resolved
 * against the Session table. Authorization decisions in every API route go
 * through the user returned here — never through anything client-supplied.
 *
 * Production replaces this module with Clerk / Supabase Auth / Auth.js; the
 * requireUser/requireAdmin call sites stay the same shape.
 */

export type SessionUser = DbUser & { notificationPrefs: NotificationPreference | null };

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { token, userId } });
  return token;
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { notificationPrefs: true } } },
  });
  return session?.user ?? null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
}

/* ------------------------- route guard helpers ------------------------- */

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

export function forbidden(message = "You don't have access to that."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(detail: unknown): NextResponse {
  return NextResponse.json({ error: "Invalid request.", detail }, { status: 400 });
}
