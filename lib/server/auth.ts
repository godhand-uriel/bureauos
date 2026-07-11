import { NextResponse } from "next/server";
import type { User as DbUser, NotificationPreference } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/server/db";

/**
 * Session resolution for API routes — Phase 2: Auth.js (NextAuth v5).
 *
 * The middleware already verified the JWT; here we re-resolve the user from
 * the database on every request so authorization decisions (role, ownership)
 * always reflect current state, never a stale token. Deleting a user
 * invalidates their access immediately even if their JWT hasn't expired.
 */

export type SessionUser = DbUser & { notificationPrefs: NotificationPreference | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPrefs: true },
  });
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
