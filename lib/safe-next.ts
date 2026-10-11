/**
 * Post-login redirect targets. Only same-site relative paths are accepted, so
 * a crafted `?next=` can never send someone to another site after sign-in.
 * Client-safe (used by the login and signup pages).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
