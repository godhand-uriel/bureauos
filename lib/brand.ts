/**
 * Public brand. Client-safe constants only.
 *
 * The product was renamed from BureauOS to Building202. Customer-facing text
 * uses BRAND_NAME; internal identifiers that predate the rename keep their
 * `bureauos` / `BUREAUOS_` spelling for compatibility (environment variables,
 * idempotency and rate-limit key prefixes, log tags, demo accounts) — see
 * docs/production_readiness.md → "Brand and legacy identifiers".
 *
 * The production domain is NOT hardcoded: absolute URLs come from
 * BUREAUOS_APP_URL at runtime (lib/server/commerce.ts → appOrigin).
 */
export const BRAND_NAME = "Building202";
