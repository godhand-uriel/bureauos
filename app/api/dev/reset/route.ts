import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, setSessionCookie, unauthorized, createSession } from "@/lib/server/auth";
import { seedDatabase, wipeDatabase } from "@/lib/server/seed-db";
import { devResetInputSchema } from "@/lib/schemas";
import { DEMO_CUSTOMER_EMAIL } from "@/lib/constants";

/**
 * Demo-workflow management: wipe all local data and optionally reseed.
 * Refused in production builds — this exists so demo/QA sessions can reset
 * the local SQLite database from Settings.
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
    // Land the caller in the demo customer session so the app keeps working.
    const demo = await prisma.user.findUnique({ where: { email: DEMO_CUSTOMER_EMAIL } });
    if (demo) {
      const token = await createSession(demo.id);
      const res = NextResponse.json({ ok: true, reseeded: true });
      setSessionCookie(res, token);
      return res;
    }
  }
  return NextResponse.json({ ok: true, reseeded: parsed.data.reseed });
}
