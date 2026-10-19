import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/passwords";
import { rateLimit } from "@/lib/server/rate-limit";

/**
 * Re-authentication for sensitive account changes (email, password, account
 * deletion). A valid session is not enough for these: the current password
 * must be supplied, and guesses are throttled per account so a hijacked
 * session cannot be used to brute-force it.
 */
export async function confirmPassword(
  user: SessionUser,
  password: string | undefined,
): Promise<"ok" | "invalid" | "throttled"> {
  if (!(await rateLimit(`reauth:${user.id}`, 8, 15 * 60_000))) return "throttled";
  if (!password || !verifyPassword(password, user.passwordHash)) return "invalid";
  return "ok";
}

export function reauthFailure(result: "invalid" | "throttled"): NextResponse {
  return result === "throttled"
    ? NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 })
    : NextResponse.json({ error: "Your current password is incorrect." }, { status: 403 });
}
