import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { checkCredentials } from "@/lib/server/credentials";
import { loginInputSchema } from "@/lib/schemas";

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
        const result = await checkCredentials(
          parsed.data.email,
          parsed.data.password,
          parsed.data.totp,
        );
        if (!result.ok) return null; // Auth.js surfaces this as CredentialsSignin
        const { user } = result;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
