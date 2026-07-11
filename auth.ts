import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/passwords";
import { loginInputSchema } from "@/lib/schemas";

/**
 * Auth.js (NextAuth v5) — full Node config.
 *
 * Credentials provider backed by the Prisma User table (scrypt hashes).
 * This replaces the Phase 1 hand-rolled Session table + cookie: Auth.js
 * issues signed/encrypted JWT session cookies (httpOnly, SameSite=Lax) and
 * its sign-in endpoints are CSRF-protected out of the box.
 *
 * Swapping to a hosted provider later (Clerk / Supabase Auth) replaces this
 * file and lib/server/passwords.ts; getSessionUser() keeps its shape.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginInputSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
          return null; // Auth.js surfaces this as CredentialsSignin
        }
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
