import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30s step) with RFC 4648 base32 secrets —
 * the exact profile Google Authenticator / 1Password / Authy implement.
 * No external dependency; correctness is locked in by tests against the
 * RFC 6238 Appendix B vectors (tests/security-hardening.test.ts).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226) for one counter value. */
function hotp(key: Buffer, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    (((mac[offset] & 0x7f) << 24) |
      ((mac[offset + 1] & 0xff) << 16) |
      ((mac[offset + 2] & 0xff) << 8) |
      (mac[offset + 3] & 0xff)) %
    10 ** digits;
  return code.toString().padStart(digits, "0");
}

export function totpAt(secretBase32: string, unixSeconds: number, digits = 6, stepSeconds = 30): string {
  return hotp(base32Decode(secretBase32), Math.floor(unixSeconds / stepSeconds), digits);
}

/**
 * Verify a submitted code with a ±1 step window (90s of clock drift total).
 * Timing-safe comparison on each candidate.
 */
export function verifyTotp(secretBase32: string, code: string, nowSeconds = Date.now() / 1000): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const submitted = Buffer.from(normalized);
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secretBase32, nowSeconds + drift * 30));
    if (expected.length === submitted.length && timingSafeEqual(expected, submitted)) {
      return true;
    }
  }
  return false;
}

/** 160-bit random secret, base32-encoded (RFC 4226 recommended length). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildOtpauthUrl(accountEmail: string, secretBase32: string): string {
  const issuer = "BureauOS";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
