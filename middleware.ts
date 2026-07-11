import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { rateLimit } from "./lib/server/rate-limit";

/**
 * Edge middleware — Phase 2 enforcement in front of every route handler:
 *
 * 1. Rate limiting (per IP; stricter on auth endpoints).
 * 2. CSRF hardening: mutating /api requests must same-origin (the JWT cookie
 *    is SameSite=Lax, this adds an explicit Origin check on top). Auth.js's
 *    own endpoints carry their own CSRF token and are excluded.
 * 3. Session enforcement: protected APIs return 401 JSON; protected pages
 *    redirect to /login. Admin pages additionally require the admin role.
 *
 * Route handlers still re-check everything against the database
 * (lib/server/auth.ts) — this layer fails fast, it is not the only gate.
 */

const { auth } = NextAuth(authConfig);

const PUBLIC_API = ["/api/health", "/api/auth"]; // /api/auth/* = Auth.js + signup + demo-seed
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

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  // 1 — rate limits
  if (pathname.startsWith("/api/auth")) {
    if (req.method !== "GET" && !rateLimit(`auth:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a minute." },
        { status: 429 },
      );
    }
  } else if (isApi && req.method !== "GET") {
    if (!rateLimit(`mutate:${ip}`, 120, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests. Slow down and try again." },
        { status: 429 },
      );
    }
  }

  // 2 — same-origin check for mutating API calls (skip Auth.js: own CSRF)
  if (isApi && req.method !== "GET" && !pathname.startsWith("/api/auth")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
    }
  }

  // 3 — session enforcement
  const signedIn = Boolean(req.auth?.user?.id);

  if (isApi) {
    const isPublic = PUBLIC_API.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!isPublic && !signedIn) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isProtectedPage && !signedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
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
