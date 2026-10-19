import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { writeAudit } from "@/lib/server/audit";
import { seedDatabase, wipeDatabase } from "@/lib/server/seed-db";
import { devResetInputSchema } from "@/lib/schemas";
import { isProduction } from "@/lib/server/credentials";

/**
 * Development/demo-only: wipe all local data and optionally reseed.
 *
 * UNCONDITIONALLY refused in production builds — there is deliberately no
 * environment-variable escape hatch, so no configuration mistake can expose
 * a database wipe to a customer deployment. Destructive production
 * operations belong to operators with database access, not to an API route.
 */
export async function POST(request: Request) {
  if (isProduction()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = devResetInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  await wipeDatabase(prisma);
  if (parsed.data.reseed) {
    await seedDatabase(prisma);
  }
  // The wipe cleared the audit trail too — record who reset, post-wipe.
  await writeAudit(user, "system.reset", "system", "database", parsed.data.reseed ? "Wiped and reseeded demo data" : "Wiped all data");
  return NextResponse.json({ ok: true, reseeded: parsed.data.reseed });
}
