import { handlers } from "@/auth";

/**
 * Auth.js endpoints (signin/signout/callback/csrf/session/providers).
 * Static sibling routes (/api/auth/signup, /api/auth/demo) take precedence
 * over this catch-all.
 */
export const { GET, POST } = handlers;
