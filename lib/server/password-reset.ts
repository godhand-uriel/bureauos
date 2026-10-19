import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/passwords";
import { queueNotification, emailTransport } from "@/lib/server/notify";
import { rateLimit } from "@/lib/server/rate-limit";
import { appOrigin } from "@/lib/server/commerce";
import { isDemoEmail } from "@/lib/server/credentials";
import { isProduction } from "@/lib/server/commerce";

/**
 * Password reset by emailed one-time link.
 *
 *  - Only a SHA-256 hash of the token is stored; the token exists only in the
 *    email, and the email's stored copy is cleared once it has been sent.
 *  - Single use, 30-minute lifetime; requesting a new link voids older ones.
 *  - Using a link bumps the account's session version, signing out every
 *    device — a reset is often a response to a compromised account.
 *  - Requests never reveal whether an email has an account.
 *  - Offered only when email can actually be delivered (or in development,
 *    where the link goes to the local outbox and server log).
 */

const TOKEN_MINUTES = 30;

export function passwordResetAvailable(): boolean {
  return emailTransport().kind !== "off";
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!passwordResetAvailable()) return;
  if (isProduction() && isDemoEmail(normalized)) return;
  // Per-address limit on top of the per-IP auth limit, so nobody can flood an inbox.
  if (!(await rateLimit(`reset:${normalized}`, 3, 60 * 60_000))) return;

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000) },
    }),
  ]);

  const link = `${appOrigin()}/reset-password?token=${token}`;
  await queueNotification(
    user.id,
    "account_security",
    "Reset your Building202 password",
    [
      "Someone asked to reset the password for your Building202 account. If it was you, use this link within 30 minutes:",
      "",
      link,
      "",
      "The link works once. If you didn't ask for this, ignore this email — your password hasn't changed.",
    ].join("\n"),
    { sensitive: true },
  );
}

export type ResetResult = { ok: true } | { ok: false; reason: "invalid_or_expired" };

export async function completePasswordReset(token: string, newPassword: string): Promise<ResetResult> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  // Mark used first, conditionally, so two concurrent submissions can't both succeed.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: "invalid_or_expired" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
  ]);

  await queueNotification(
    record.userId,
    "account_security",
    "Your Building202 password was reset",
    "Your Building202 password was just reset using an emailed link, and all devices were signed out. If this wasn't you, reset it again right away and contact support.",
  );
  return { ok: true };
}
