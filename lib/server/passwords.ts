import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Demo-grade password hashing (scrypt, per-user salt). Materially better than
 * the old client-side hash, but the whole module is still slated for deletion
 * when a real auth provider (Clerk / Supabase Auth / Auth.js) lands.
 */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
