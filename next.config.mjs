const isDev = process.env.NODE_ENV !== "production";
// Force-HTTPS behaviour (HSTS, upgrade-insecure-requests) only for a deployment
// that is actually served over TLS — read at build time, so set
// BUREAUOS_APP_URL when building for production.
const servedOverTls = /^https:\/\//i.test(process.env.BUREAUOS_APP_URL ?? "");

/**
 * Content-Security-Policy.
 *
 * Everything is same-origin: no third-party scripts, styles, fonts, frames or
 * API calls (Stripe Checkout is a full-page redirect, not an embed). The one
 * concession is 'unsafe-inline' for scripts and styles, which the Next.js App
 * Router needs for its hydration payload unless every page is made dynamic
 * with a per-request nonce. Injected markup is still contained: it cannot
 * load code from another origin, post a form elsewhere, change the base URL,
 * or be framed. Development additionally needs 'unsafe-eval' for React
 * Refresh and a websocket for hot reload.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(servedOverTls ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(servedOverTls ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Authenticated API responses must never be stored by a shared cache.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
