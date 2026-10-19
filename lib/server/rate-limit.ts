/**
 * Rate limiter (edge-runtime compatible).
 *
 * Two backends behind one signature:
 *
 *  - Shared (multi-instance safe): Upstash Redis over its REST API, used when
 *    UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both set. A
 *    fixed-window counter keyed by caller + window bucket.
 *  - In-memory sliding window: correct for a single long-lived process only.
 *    On serverless or multi-instance deployments each instance counts
 *    separately, so limits are not enforced globally — configure the shared
 *    backend there.
 *
 * If the shared backend errors or times out, the limiter falls back to the
 * in-memory window rather than rejecting traffic.
 */

interface Window {
  timestamps: number[];
}

const buckets = new Map<string, Window>();
let lastSweep = 0;

export function sharedRateLimitConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function memoryRateLimit(key: string, limit: number, windowMs: number, now: number): boolean {
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

async function sharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const redisKey = `bureauos:rl:${key}:${Math.floor(now / windowMs)}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs * 2)],
      ]),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown }[];
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) return null;
    return count <= limit;
  } catch {
    return null;
  }
}

/** True if the caller identified by `key` is within `limit` hits per `windowMs`. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  if (sharedRateLimitConfigured()) {
    const shared = await sharedRateLimit(key, limit, windowMs, now);
    if (shared !== null) return shared;
  }
  return memoryRateLimit(key, limit, windowMs, now);
}

/** Test hook: clear the in-memory windows. */
export function resetRateLimitMemory(): void {
  buckets.clear();
  lastSweep = 0;
}
