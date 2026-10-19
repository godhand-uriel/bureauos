import type { DefaultSession } from "next-auth";

/**
 * Session/JWT type augmentation: Building202 carries the user id, role, and the
 * account's session version (bumped on password change — see lib/server/auth.ts).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "customer" | "admin";
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    sv?: number;
  }
}
