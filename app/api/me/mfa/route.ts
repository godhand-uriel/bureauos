import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/server/auth";
import { writeAudit } from "@/lib/server/audit";
import { buildOtpauthUrl, generateTotpSecret, verifyTotp } from "@/lib/server/totp";
import { mfaVerifyInputSchema } from "@/lib/schemas";

/**
 * Staff MFA (TOTP) enrollment, scoped to admin accounts — the policy in
 * lib/server/credentials.ts requires enrolled MFA for staff sign-in in
 * production.
 *
 *   POST   → begin enrollment: generate + store a pending secret, return the
 *            otpauth URI for the authenticator app (shown once in the UI)
 *   PUT    → confirm enrollment with a valid code → mfaEnabled = true
 *   DELETE → disable MFA (requires a currently-valid code)
 */

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("MFA enrollment is for staff accounts.");
  if (user.mfaEnabled) return forbidden("MFA is already enabled. Disable it first to re-enroll.");

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret, mfaEnabled: false } });
  return NextResponse.json({ secret, otpauth: buildOtpauthUrl(user.email, secret) });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("MFA enrollment is for staff accounts.");
  if (!user.mfaSecret) return badRequest("No pending enrollment. Start enrollment first.");

  const parsed = mfaVerifyInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  if (!verifyTotp(user.mfaSecret, parsed.data.code)) {
    return forbidden("That code didn't verify. Check your authenticator app and try again.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  await writeAudit(user, "auth.mfa_enabled", "system", user.id, "Staff MFA enrolled");
  return NextResponse.json({ ok: true, mfaEnabled: true });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("MFA enrollment is for staff accounts.");
  if (!user.mfaEnabled) return badRequest("MFA is not enabled.");

  const parsed = mfaVerifyInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  if (!verifyTotp(user.mfaSecret, parsed.data.code)) {
    return forbidden("That code didn't verify. MFA remains enabled.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: "" } });
  await writeAudit(user, "auth.mfa_disabled", "system", user.id, "Staff MFA disabled");
  return NextResponse.json({ ok: true, mfaEnabled: false });
}
