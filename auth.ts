import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { checkCredentials } from "@/lib/server/credentials";
import { rateLimit } from "@/lib/server/rate-limit";
import { loginInputSchema } from "@/lib/schemas";

const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;

/**
 * Auth.js (NextAuth v5) — full Node config.
 *
 * Credentials provider backed by the Prisma User table (scrypt hashes).
 * The actual credential + MFA policy lives in lib/server/credentials.ts so
 * it is integration-testable; this callback only adapts it to Auth.js.
 * All failure reasons collapse to a generic sign-in failure — the login form
 * never learns whether the email exists, the password was wrong, or MFA was
 * the blocker.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(credentials) {
        const parsed = loginInputSchema.safeParse(credentials);
        if (!parsed.success) return null;
        // Per-account throttle on top of the per-IP limit in middleware, so
        // guessing one account's password (or TOTP code) from many addresses
        // is bounded too. Counts every attempt; a locked-out owner waits it out.
        const account = parsed.data.email.trim().toLowerCase();
        if (!(await rateLimit(`login:${account}`, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS))) return null;
        const result = await checkCredentials(
          parsed.data.email,
          parsed.data.password,
          parsed.data.totp,
        );
        if (!result.ok) return null; // Auth.js surfaces this as CredentialsSignin
        const { user } = result;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
