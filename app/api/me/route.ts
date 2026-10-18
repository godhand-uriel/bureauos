import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, unauthorized } from "@/lib/server/auth";
import { confirmPassword, reauthFailure } from "@/lib/server/reauth";
import { cancelPendingCheckouts } from "@/lib/server/payments";
import { isDemoEmail } from "@/lib/server/credentials";
import { userToDomain } from "@/lib/server/serializers";
import { deleteAccountInputSchema, profileUpdateSchema } from "@/lib/schemas";

/**
 * Profile update. Only name / email / state / phone are accepted — role,
 * password hash and MFA state are not part of the schema and cannot be set
 * here. Changing the sign-in email requires the current password: with only a
 * session, an attacker could otherwise repoint the account at their own address.
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { name, usState, phone, currentPassword } = parsed.data;
  const email = parsed.data.email?.toLowerCase();

  const changingEmail = email !== undefined && email !== user.email;
  if (changingEmail) {
    const check = await confirmPassword(user, currentPassword);
    if (check !== "ok") return reauthFailure(check);
    // The demo addresses are reserved (they are refused at sign-in in production).
    if (isDemoEmail(email)) {
      return NextResponse.json({ error: "That email address can't be used." }, { status: 409 });
    }
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
    if (taken) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(changingEmail && { email }),
      ...(usState !== undefined && { usState }),
      ...(phone !== undefined && { phone }),
    },
    include: { notificationPrefs: true },
  });
  return NextResponse.json({ user: userToDomain(updated) });
}

/**
 * Delete the signed-in account and everything attached to it.
 *
 * Requires the current password and a typed confirmation. Cases, intake
 * answers, plans, deadlines, letters, tickets, acceptances, notifications and
 * entitlements are removed (database cascades from User). What remains:
 *  - Purchase rows, with the user and case links nulled — financial records
 *    BureauOS must keep, no longer attributable to a person from our side
 *    (Stripe holds its own records under its own retention rules).
 *  - Audit entries about staff actions, which reference ids only.
 * Staff accounts are not self-deletable: removing an operator is an
 * administrative action, and the audit trail must keep its actor.
 */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = deleteAccountInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  if (user.role === "admin") {
    return forbidden("Staff accounts can't be deleted from the app. Ask another administrator to remove it.");
  }
  const check = await confirmPassword(user, parsed.data.password);
  if (check !== "ok") return reauthFailure(check);

  // Close any open Stripe Checkout sessions first so a payment can't land on
  // an account that no longer exists.
  await cancelPendingCheckouts({ userId: user.id });

  await prisma.user.delete({ where: { id: user.id } });

  // A record that a deletion happened — the internal id only, no name or email.
  await prisma.auditLog
    .create({
      data: {
        actorId: user.id,
        actorName: "Deleted account",
        actorRole: "customer",
        action: "account.deleted",
        targetType: "system",
        targetId: user.id,
        detail: "Account and associated data deleted at the account holder's request.",
      },
    })
    .catch((err) => console.error("[bureauos] audit write failed", { action: "account.deleted" }, err));

  return NextResponse.json({ ok: true });
}
