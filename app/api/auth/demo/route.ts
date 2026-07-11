import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { createSession, setSessionCookie, badRequest } from "@/lib/server/auth";
import { userToDomain } from "@/lib/server/serializers";
import { seedDatabase } from "@/lib/server/seed-db";
import { demoLoginInputSchema } from "@/lib/schemas";
import { DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL } from "@/lib/constants";

/** One-click demo login. Seeds the demo data on first use if `npm run db:seed` was skipped. */
export async function POST(request: Request) {
  const parsed = demoLoginInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const email = parsed.data.role === "admin" ? DEMO_ADMIN_EMAIL : DEMO_CUSTOMER_EMAIL;
  let user = await prisma.user.findUnique({ where: { email }, include: { notificationPrefs: true } });
  if (!user) {
    await seedDatabase(prisma);
    user = await prisma.user.findUnique({ where: { email }, include: { notificationPrefs: true } });
  }
  if (!user) {
    return NextResponse.json({ error: "Demo accounts are unavailable." }, { status: 500 });
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({ user: userToDomain(user) });
  setSessionCookie(res, token);
  return res;
}
