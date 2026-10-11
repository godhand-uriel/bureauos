import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration (no Prisma/Node-only imports) — shared by
 * the middleware (JWT verification only) and the full config in auth.ts.
 *
 * Sessions are stateless JWTs signed+encrypted with AUTH_SECRET, so the
 * middleware can enforce auth without a database round-trip. API routes
 * re-resolve the user from the database on every request (lib/server/auth.ts),
 * so role/ownership decisions never rely on a stale token alone.
 */
export const authConfig = {
  // The deployment's proxy/platform sets the Host header (Vercel, or a reverse
  // proxy configured to pass it through). Set AUTH_URL to pin it explicitly.
  trustHost: true,
  // 7-day sessions, refreshed at most daily. Routes re-resolve the user from
  // the database on every request, so a deleted/demoted account loses access
  // immediately regardless of token lifetime.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  pages: { signIn: "/login" },
  providers: [], // credentials provider added in auth.ts (needs Prisma)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "customer";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "customer" | "admin") ?? "customer";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
