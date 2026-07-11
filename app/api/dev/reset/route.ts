import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { seedDatabase, wipeDatabase } from "@/lib/server/seed-db";
import { devResetInputSchema } from "@/lib/schemas";

/**
 * Demo-workflow management: wipe all local data and optionally reseed.
 * Refused in production builds. After a reset the caller's account no longer
 * exists — the client signs back in through Auth.js (demo credentials on
 * reseed) rather than this route minting a session.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.BUREAUOS_ALLOW_RESET !== "true") {
    return NextResponse.json({ error: "Reset is disabled in production." }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = devResetInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  await wipeDatabase(prisma);
  if (parsed.data.reseed) {
    await seedDatabase(prisma);
  }
  return NextResponse.json({ ok: true, reseeded: parsed.data.reseed });
}
