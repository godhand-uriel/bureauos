import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { confirmPassword, reauthFailure } from "@/lib/server/reauth";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { queueNotification } from "@/lib/server/notify";
import { changePasswordInputSchema } from "@/lib/schemas";

/**
 * Change the account password. Requires the current password. Bumping
 * sessionVersion invalidates every existing session for the account —
 * including this one — so the client signs in again with the new password.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = changePasswordInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { currentPassword, newPassword } = parsed.data;

  const check = await confirmPassword(user, currentPassword);
  if (check !== "ok") return reauthFailure(check);
  if (verifyPassword(newPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Choose a password you haven't just been using." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } },
  });
  // Outstanding reset links die with the old password.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  await queueNotification(
    user.id,
    "account_security",
    "Your Building202 password was changed",
    "The password for your Building202 account was just changed, and all devices were signed out. If this wasn't you, reset your password right away and contact support.",
  );
  return NextResponse.json({ ok: true });
}
