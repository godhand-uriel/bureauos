import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { seedDatabase } from "@/lib/server/seed-db";
import { DEMO_CUSTOMER_EMAIL } from "@/lib/constants";

/**
 * Demo preflight: ensures the demo accounts/data exist (in case
 * `npm run db:seed` was skipped). The actual sign-in happens through the
 * CSRF-protected Auth.js credentials flow — this route never creates a
 * session itself.
 */
export async function POST() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_CUSTOMER_EMAIL } });
  if (!existing) {
    await seedDatabase(prisma);
  }
  return NextResponse.json({ ok: true });
}
