import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/passwords";
import { verifyTotp } from "@/lib/server/totp";
import { DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL } from "@/lib/constants";
import type { User } from "@prisma/client";

/**
 * Credential + MFA policy for sign-in, extracted from the Auth.js authorize
 * callback so the rules are directly integration-testable:
 *
 *  1. Password must verify (scrypt, timing-safe).
 *  2. Demo accounts cannot sign in at all in production — even if their rows
 *     exist in a migrated database. The shared demo password is published in
 *     the repo, so this is enforced here, not just by not seeding.
 *  3. Accounts with MFA enrolled must supply a valid TOTP code.
 *  4. In production, staff (admin) accounts MUST have MFA enrolled to sign in
 *     (override: BUREAUOS_REQUIRE_STAFF_MFA="false"; in development it is
 *     opt-in via BUREAUOS_REQUIRE_STAFF_MFA="true"). Enrollment happens in a
 *     non-production environment or via `npm run admin:provision`.
 *
 * Failures return a reason for tests/logs; the authorize callback collapses
 * them to a generic sign-in failure so the login form never leaks which rule
 * rejected the attempt.
 */

export type CredentialCheck =
  | { ok: true; user: User }
  | {
      ok: false;
      reason:
        | "invalid_credentials"
        | "demo_disabled_in_production"
        | "mfa_code_required"
        | "mfa_code_invalid"
        | "staff_mfa_enrollment_required";
    };

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function staffMfaRequired(): boolean {
  if (isProduction()) return process.env.BUREAUOS_REQUIRE_STAFF_MFA !== "false";
  return process.env.BUREAUOS_REQUIRE_STAFF_MFA === "true";
}

export function isDemoEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return normalized === DEMO_CUSTOMER_EMAIL || normalized === DEMO_ADMIN_EMAIL;
}

export async function checkCredentials(
  email: string,
  password: string,
  totp?: string,
): Promise<CredentialCheck> {
  const normalized = email.trim().toLowerCase();

  if (isProduction() && isDemoEmail(normalized)) {
    return { ok: false, reason: "demo_disabled_in_production" };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (user.mfaEnabled) {
    if (!totp) return { ok: false, reason: "mfa_code_required" };
    if (!verifyTotp(user.mfaSecret, totp)) return { ok: false, reason: "mfa_code_invalid" };
  } else if (user.role === "admin" && staffMfaRequired()) {
    return { ok: false, reason: "staff_mfa_enrollment_required" };
  }

  return { ok: true, user };
}
