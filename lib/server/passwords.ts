import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing (scrypt, per-user salt, timing-safe compare) — backs the
 * Auth.js credentials provider (auth.ts). If BureauOS later moves to a hosted
 * identity provider (Clerk / Supabase Auth), this module goes away with it.
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
