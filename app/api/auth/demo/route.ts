import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { seedDatabase } from "@/lib/server/seed-db";
import { DEMO_CUSTOMER_EMAIL } from "@/lib/constants";
import { isProduction } from "@/lib/server/credentials";

/**
 * Development/demo-only preflight: ensures the demo accounts/data exist (in
 * case `npm run db:seed` was skipped). Sign-in still goes through the
 * CSRF-protected Auth.js credentials flow — this route never mints a session.
 *
 * Refused outright in production: demo accounts use a password published in
 * the repository, so production must neither create them (here or via seed)
 * nor accept their sign-in (enforced independently in
 * lib/server/credentials.ts, even against a migrated database that already
 * contains the rows).
 */
export async function POST() {
  if (isProduction()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const existing = await prisma.user.findUnique({ where: { email: DEMO_CUSTOMER_EMAIL } });
  if (!existing) {
    await seedDatabase(prisma);
  }
  return NextResponse.json({ ok: true });
}
