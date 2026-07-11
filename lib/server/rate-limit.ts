/**
 * In-memory sliding-window rate limiter (edge-runtime compatible).
 *
 * Per-instance only: good for local development and a single-node deploy.
 * Production should swap this for a shared store (Upstash Redis or
 * equivalent) behind the same `rateLimit` signature — the middleware call
 * sites don't change.
 */

interface Window {
  timestamps: number[];
}

const buckets = new Map<string, Window>();
let lastSweep = 0;

/** True if the caller identified by `key` is within `limit` hits per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Periodic sweep so abandoned keys don't accumulate forever.
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, w] of buckets) {
      if (w.timestamps.length === 0 || now - w.timestamps[w.timestamps.length - 1] > windowMs) {
        buckets.delete(k);
      }
    }
  }

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}
