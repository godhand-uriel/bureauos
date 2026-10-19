/**
 * Edge-safe request guards used by the middleware. Pure functions over
 * headers so the trust assumptions are unit-testable.
 */

/**
 * Client IP for rate-limit keys.
 *
 * `X-Forwarded-For` is a comma-separated chain where each proxy APPENDS the
 * address it received the request from. Everything left of the entries added
 * by our own trusted proxies is client-controlled, so the leftmost value must
 * never be used. With N trusted proxy hops in front of the app, the real
 * client address is the Nth entry from the right.
 *
 * BUREAUOS_TRUSTED_PROXY_HOPS (default 1 — a single platform proxy such as
 * Vercel, or one nginx/ALB). Set 0 when the app is exposed directly: the
 * header is then ignored entirely and all callers share one bucket.
 */
export function clientIp(headers: Headers, hops = trustedProxyHops()): string {
  if (hops <= 0) return "direct";
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (chain.length < hops) return "unknown";
  return chain[chain.length - hops];
}

export function trustedProxyHops(): number {
  const raw = process.env.BUREAUOS_TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/**
 * CSRF defense for cookie-authenticated mutations (on top of SameSite=Lax).
 *
 * A browser always sends `Origin` on cross-origin state-changing requests, so:
 *  - `Sec-Fetch-Site: cross-site` → refused outright
 *  - an `Origin` that fails to parse (including the literal "null" sent from
 *    sandboxed/opaque contexts) → refused
 *  - an `Origin` whose host differs from the app's → refused
 *  - no `Origin` at all → allowed: that is a non-browser client, which carries
 *    no ambient victim cookies and is not a CSRF vector
 *
 * When BUREAUOS_APP_URL is set, the Origin must match it exactly (use this
 * behind proxies that rewrite the Host header). Otherwise it is compared with
 * the request's Host header.
 */
export function isAllowedOrigin(headers: Headers, appUrl = process.env.BUREAUOS_APP_URL): boolean {
  if (headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = headers.get("origin");
  if (origin === null) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (appUrl) {
    try {
      return parsed.origin === new URL(appUrl).origin;
    } catch {
      return false;
    }
  }

  const host = headers.get("host");
  return host !== null && parsed.host === host;
}

export { safeNextPath } from "@/lib/safe-next";
