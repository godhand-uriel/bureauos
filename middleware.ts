import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { rateLimit } from "./lib/server/rate-limit";
import { clientIp, isAllowedOrigin } from "./lib/server/request-guards";

/**
 * Edge middleware — enforcement in front of every route handler:
 *
 * 1. Rate limiting (per client IP; stricter on auth endpoints). Shared across
 *    instances when Upstash is configured — see lib/server/rate-limit.ts.
 * 2. CSRF hardening: cookie-authenticated mutations must be same-origin
 *    (lib/server/request-guards.ts). Auth.js's own endpoints carry their own
 *    CSRF token; machine-to-machine endpoints authenticate by signature or
 *    bearer secret instead and are excluded.
 * 3. Session enforcement: protected APIs return 401 JSON; protected pages
 *    redirect to /login. Admin pages additionally require the admin role.
 *
 * Route handlers still re-check everything against the database
 * (lib/server/auth.ts) — this layer fails fast, it is not the only gate.
 */

const { auth } = NextAuth(authConfig);

/** Authenticated by Stripe signature / cron bearer secret, never by session. */
const MACHINE_API = ["/api/stripe/webhook", "/api/internal"];
const PUBLIC_API = ["/api/health", "/api/auth", "/api/commerce/offer", ...MACHINE_API];
const PROTECTED_PAGES = [
  "/dashboard",
  "/assistant",
  "/navigators",
  "/cases",
  "/support",
  "/billing",
  "/checkout",
  "/settings",
  "/admin",
];

const under = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const isMachine = under(pathname, MACHINE_API);
  const mutating = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
  const ip = clientIp(req.headers);

  // 1 — rate limits
  if (pathname.startsWith("/api/auth")) {
    if (mutating && !(await rateLimit(`auth:${ip}`, 20, 60_000))) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a minute." },
        { status: 429 },
      );
    }
  } else if (isApi && mutating && !isMachine) {
    if (!(await rateLimit(`mutate:${ip}`, 120, 60_000))) {
      return NextResponse.json(
        { error: "Too many requests. Slow down and try again." },
        { status: 429 },
      );
    }
  }

  // 2 — same-origin check for cookie-authenticated mutations
  if (isApi && mutating && !pathname.startsWith("/api/auth/") && !isMachine) {
    if (!isAllowedOrigin(req.headers)) {
      return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
    }
  }
  // /api/auth/signup and /api/auth/demo are ours (not Auth.js) — same check.
  if (mutating && (pathname === "/api/auth/signup" || pathname === "/api/auth/demo")) {
    if (!isAllowedOrigin(req.headers)) {
      return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
    }
  }

  // 3 — session enforcement
  const signedIn = Boolean(req.auth?.user?.id);

  if (isApi) {
    if (!under(pathname, PUBLIC_API) && !signedIn) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (under(pathname, PROTECTED_PAGES) && !signedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname.startsWith("/admin") && req.auth?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  // Everything except static assets — the handler itself decides per path.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
