import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the launch security fixes: paid-tier escalation,
 * demo/reset isolation in production, staff MFA, role mass-assignment,
 * origin/IP guards, and the rate limiter. Real route handlers + real test
 * database; only session resolution is mocked.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentUser: any = null;

vi.mock("@/lib/server/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    getSessionUser: async () => currentUser,
    unauthorized: () => NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message = "Not found.") => NextResponse.json({ error: message }, { status: 404 }),
    badRequest: (detail: unknown) =>
      NextResponse.json({ error: "Invalid request.", detail }, { status: 400 }),
  };
});

import { prisma } from "@/lib/server/db";
import { seedDatabase, wipeDatabase } from "@/lib/server/seed-db";
import { hashPassword } from "@/lib/server/passwords";
import { checkCredentials } from "@/lib/server/credentials";
import { base32Decode, base32Encode, generateTotpSecret, totpAt, verifyTotp } from "@/lib/server/totp";
import { performCaseAction } from "@/lib/server/case-actions";
import { clientIp, isAllowedOrigin, safeNextPath } from "@/lib/server/request-guards";
import { rateLimit, resetRateLimitMemory } from "@/lib/server/rate-limit";
import { DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD } from "@/lib/constants";
import { POST as demoPOST } from "@/app/api/auth/demo/route";
import { POST as resetPOST } from "@/app/api/dev/reset/route";
import { existsSync } from "fs";
import path from "path";
import { POST as caseActionPOST } from "@/app/api/cases/[id]/actions/route";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { PATCH as mePATCH } from "@/app/api/me/route";
import { POST as mfaPOST, PUT as mfaPUT, DELETE as mfaDELETE } from "@/app/api/me/mfa/route";
import { GET as bootstrapGET } from "@/app/api/bootstrap/route";

const json = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const withPrefs = { notificationPrefs: true } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let customer: any, admin: any, staff: any;
let ownCaseId: string;
const STAFF_PASSWORD = "correct-horse-battery";

beforeAll(async () => {
  await wipeDatabase(prisma);
  await seedDatabase(prisma);
  customer = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_CUSTOMER_EMAIL }, include: withPrefs });
  admin = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_ADMIN_EMAIL }, include: withPrefs });
  staff = await prisma.user.create({
    data: { email: "staff@example.com", name: "Real Staff", passwordHash: hashPassword(STAFF_PASSWORD), role: "admin" },
    include: withPrefs,
  });
  await prisma.user.create({
    data: { email: "real-customer@example.com", name: "Real Customer", passwordHash: hashPassword(STAFF_PASSWORD), role: "customer" },
  });
  ownCaseId = (await prisma.case.findFirstOrThrow({ where: { userId: customer.id } })).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetRateLimitMemory();
});

/* ------------------------------------------------------------------ */

describe("paid-tier escalation is closed", () => {
  it("rejects a customer's set_tier on their own case (service function)", async () => {
    const before = await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } });
    const result = await performCaseAction(customer, ownCaseId, { type: "set_tier", tier: "priority" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    const after = await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } });
    expect(after.serviceTier).toBe(before.serviceTier);
  });

  it("rejects a forged set_tier sent directly to the HTTP route", async () => {
    currentUser = customer;
    const before = await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } });
    const res = await caseActionPOST(json({ type: "set_tier", tier: "done_with_you" }), params(ownCaseId));
    expect(res.status).toBe(403);
    const after = await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } });
    expect(after.serviceTier).toBe(before.serviceTier);
  });

  it("staff cannot apply a human-assisted tier while that service is switched off", async () => {
    const before = await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } });
    const result = await performCaseAction(admin, ownCaseId, { type: "set_tier", tier: "priority" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } })).serviceTier).toBe(before.serviceTier);
  });

  it("allows a staff override when the service is on, and always writes an audit record", async () => {
    vi.stubEnv("BUREAUOS_HUMAN_REVIEW_ENABLED", "true");
    const auditBefore = await prisma.auditLog.count({ where: { action: "case.set_tier", targetId: ownCaseId } });
    const original = (await prisma.case.findUniqueOrThrow({ where: { id: ownCaseId } })).serviceTier;
    const result = await performCaseAction(admin, ownCaseId, { type: "set_tier", tier: "priority" });
    expect(result.ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "case.set_tier", targetId: ownCaseId } })).toBe(auditBefore + 1);
    await performCaseAction(admin, ownCaseId, { type: "set_tier", tier: original as "self_service" });
  });

  it("the simulated billing endpoint no longer exists", () => {
    // Plan changes used to be a customer-callable simulation. The only paths
    // to paid access now are the verified Stripe webhook and audited staff
    // grants (tests/payments.test.ts).
    expect(existsSync(path.join(process.cwd(), "app", "api", "billing"))).toBe(false);
  });

  it("blocks regenerate_plan on a case whose intake was never completed", async () => {
    const kase = await prisma.case.create({
      data: { userId: customer.id, navigatorSlug: "job-separation", title: "no intake yet" },
    });
    const result = await performCaseAction(customer, kase.id, { type: "regenerate_plan" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(await prisma.actionPlan.findUnique({ where: { caseId: kase.id } })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("demo accounts and reset are isolated from production", () => {
  it("demo preflight returns 404 in production and creates nothing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const users = await prisma.user.count();
    expect((await demoPOST()).status).toBe(404);
    expect(await prisma.user.count()).toBe(users);
  });

  it("the seed function itself refuses to run in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(seedDatabase(prisma)).rejects.toThrow(/never be seeded in production/);
  });

  it("reset returns 404 in production — even for an admin, even with the old override env", async () => {
    currentUser = admin;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUREAUOS_ALLOW_RESET", "true");
    const cases = await prisma.case.count();
    const res = await resetPOST(json({ reseed: false }));
    expect(res.status).toBe(404);
    expect(await prisma.case.count()).toBe(cases);
    expect(cases).toBeGreaterThan(0);
  });

  it("demo credentials cannot sign in in production even though the rows exist", async () => {
    expect((await checkCredentials(DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD)).ok).toBe(true); // dev
    vi.stubEnv("NODE_ENV", "production");
    for (const email of [DEMO_CUSTOMER_EMAIL, DEMO_ADMIN_EMAIL, DEMO_ADMIN_EMAIL.toUpperCase()]) {
      const result = await checkCredentials(email, DEMO_PASSWORD);
      expect(result).toEqual({ ok: false, reason: "demo_disabled_in_production" });
    }
  });
});

/* ------------------------------------------------------------------ */

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 Appendix B, SHA-1, secret = ASCII "12345678901234567890".
  const SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
  const VECTORS: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  it("matches the RFC test vectors", () => {
    expect(SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    for (const [t, expected] of VECTORS) {
      expect(totpAt(SECRET, t, 8)).toBe(expected);
      expect(totpAt(SECRET, t, 6)).toBe(expected.slice(2));
    }
  });

  it("round-trips base32", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("accepts ±1 time step and nothing further; rejects malformed codes", () => {
    const now = 1_700_000_000;
    expect(verifyTotp(SECRET, totpAt(SECRET, now), now)).toBe(true);
    expect(verifyTotp(SECRET, totpAt(SECRET, now - 30), now)).toBe(true);
    expect(verifyTotp(SECRET, totpAt(SECRET, now + 30), now)).toBe(true);
    expect(verifyTotp(SECRET, totpAt(SECRET, now - 90), now)).toBe(false);
    expect(verifyTotp(SECRET, totpAt(SECRET, now + 90), now)).toBe(false);
    expect(verifyTotp(SECRET, "abcdef", now)).toBe(false);
    expect(verifyTotp(SECRET, "12345", now)).toBe(false);
    expect(verifyTotp(SECRET, "", now)).toBe(false);
  });
});

describe("staff MFA policy at sign-in", () => {
  it("development: staff without MFA can sign in; wrong password never can", async () => {
    expect((await checkCredentials("staff@example.com", STAFF_PASSWORD)).ok).toBe(true);
    expect(await checkCredentials("staff@example.com", "wrong-password")).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
    expect(await checkCredentials("nobody@example.com", STAFF_PASSWORD)).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });

  it("production: staff without enrolled MFA are refused; customers are unaffected", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await checkCredentials("staff@example.com", STAFF_PASSWORD)).toEqual({
      ok: false,
      reason: "staff_mfa_enrollment_required",
    });
    expect((await checkCredentials("real-customer@example.com", STAFF_PASSWORD)).ok).toBe(true);
  });

  it("enrolled accounts need a valid current code in every environment", async () => {
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: staff.id }, data: { mfaSecret: secret, mfaEnabled: true } });
    for (const env of ["development", "production"]) {
      vi.stubEnv("NODE_ENV", env);
      expect(await checkCredentials("staff@example.com", STAFF_PASSWORD)).toEqual({
        ok: false,
        reason: "mfa_code_required",
      });
      expect(await checkCredentials("staff@example.com", STAFF_PASSWORD, "000000")).toEqual({
        ok: false,
        reason: "mfa_code_invalid",
      });
      const good = totpAt(secret, Date.now() / 1000);
      expect((await checkCredentials("staff@example.com", STAFF_PASSWORD, good)).ok).toBe(true);
    }
    await prisma.user.update({ where: { id: staff.id }, data: { mfaSecret: "", mfaEnabled: false } });
  });

  it("enrollment route: customers refused; staff enroll, confirm, and disable with valid codes only", async () => {
    currentUser = customer;
    expect((await mfaPOST()).status).toBe(403);

    currentUser = await prisma.user.findUniqueOrThrow({ where: { id: staff.id }, include: withPrefs });
    const begin = await (await mfaPOST()).json();
    expect(begin.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(begin.otpauth).toContain("otpauth://totp/BureauOS");

    currentUser = await prisma.user.findUniqueOrThrow({ where: { id: staff.id }, include: withPrefs });
    expect((await mfaPUT(json({ code: "000000" }, "PUT"))).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).mfaEnabled).toBe(false);

    expect((await mfaPUT(json({ code: totpAt(begin.secret, Date.now() / 1000) }, "PUT"))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).mfaEnabled).toBe(true);

    // The secret is never serialized to any client.
    currentUser = await prisma.user.findUniqueOrThrow({ where: { id: staff.id }, include: withPrefs });
    const bootstrap = JSON.stringify(await (await bootstrapGET()).json());
    expect(bootstrap).not.toContain(begin.secret);
    expect(bootstrap).not.toContain("scrypt:");
    expect(bootstrap).toContain('"mfaEnabled":true');

    expect((await mfaDELETE(json({ code: "000000" }, "DELETE"))).status).toBe(403);
    expect((await mfaDELETE(json({ code: totpAt(begin.secret, Date.now() / 1000) }, "DELETE"))).status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(after.mfaEnabled).toBe(false);
    expect(after.mfaSecret).toBe("");
  });
});

/* ------------------------------------------------------------------ */

describe("roles cannot be assigned by customer input", () => {
  it("signup ignores role/MFA fields in the request body", async () => {
    const res = await signupPOST(
      json({
        name: "Mallory",
        email: "mallory@example.com",
        password: "long-enough-password",
        usState: "Florida",
        role: "admin",
        mfaEnabled: true,
        id: "user-demo-admin",
      }),
    );
    expect(res.status).toBe(200);
    const created = await prisma.user.findUniqueOrThrow({ where: { email: "mallory@example.com" } });
    expect(created.role).toBe("customer");
    expect(created.mfaEnabled).toBe(false);
    expect(created.id).not.toBe("user-demo-admin");
  });

  it("signup rejects short passwords", async () => {
    const res = await signupPOST(json({ name: "Shorty", email: "shorty@example.com", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("profile update cannot change role, password hash, or MFA state", async () => {
    currentUser = await prisma.user.findUniqueOrThrow({ where: { email: "mallory@example.com" }, include: withPrefs });
    const res = await mePATCH(
      json({ name: "Mallory M", role: "admin", passwordHash: "x", mfaEnabled: true, mfaSecret: "AAAA" }, "PATCH"),
    );
    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { email: "mallory@example.com" } });
    expect(after.name).toBe("Mallory M");
    expect(after.role).toBe("customer");
    expect(after.mfaEnabled).toBe(false);
    expect(after.mfaSecret).toBe("");
    expect(after.passwordHash.startsWith("scrypt:")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("request guards", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("takes the client IP from the trusted end of X-Forwarded-For, never the spoofable start", () => {
    const spoofed = h({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    expect(clientIp(spoofed, 1)).toBe("203.0.113.9");
    expect(clientIp(h({ "x-forwarded-for": "9.9.9.9, 198.51.100.7, 10.0.0.1" }), 2)).toBe("198.51.100.7");
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.9" }), 1)).toBe("203.0.113.9");
    expect(clientIp(h({}), 1)).toBe("unknown");
    expect(clientIp(spoofed, 0)).toBe("direct"); // header ignored when no proxy is trusted
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4" }), 2)).toBe("unknown");
  });

  it("refuses cross-origin, opaque, and malformed origins; allows same-origin and non-browser calls", () => {
    expect(isAllowedOrigin(h({ origin: "http://localhost:3000", host: "localhost:3000" }), "")).toBe(true);
    expect(isAllowedOrigin(h({ host: "localhost:3000" }), "")).toBe(true); // no Origin: non-browser client
    expect(isAllowedOrigin(h({ origin: "https://evil.example", host: "localhost:3000" }), "")).toBe(false);
    expect(isAllowedOrigin(h({ origin: "null", host: "localhost:3000" }), "")).toBe(false);
    expect(isAllowedOrigin(h({ origin: "not a url", host: "localhost:3000" }), "")).toBe(false);
    expect(
      isAllowedOrigin(h({ origin: "http://localhost:3000", host: "localhost:3000", "sec-fetch-site": "cross-site" }), ""),
    ).toBe(false);
    // Pinned app URL: Host header is not trusted, the origin must match exactly.
    expect(isAllowedOrigin(h({ origin: "https://app.example.com", host: "internal:8080" }), "https://app.example.com")).toBe(true);
    expect(isAllowedOrigin(h({ origin: "https://app.example.com.evil.io", host: "app.example.com" }), "https://app.example.com")).toBe(false);
    expect(isAllowedOrigin(h({ origin: "http://app.example.com", host: "app.example.com" }), "https://app.example.com")).toBe(false);
  });

  it("only accepts same-site relative post-login destinations", () => {
    expect(safeNextPath("/cases/new?navigator=job-separation")).toBe("/cases/new?navigator=job-separation");
    expect(safeNextPath("https://evil.example/")).toBe("/dashboard");
    expect(safeNextPath("//evil.example/")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });
});

describe("rate limiter", () => {
  it("in-memory window enforces the limit per key", async () => {
    for (let i = 0; i < 3; i++) expect(await rateLimit("k1", 3, 60_000)).toBe(true);
    expect(await rateLimit("k1", 3, 60_000)).toBe(false);
    expect(await rateLimit("k2", 3, 60_000)).toBe(true);
  });

  it("uses the shared backend when configured and honours its counter", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example-upstash.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    let count = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      count += 1;
      expect(String(_url)).toBe("https://example-upstash.invalid/pipeline");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
      const commands = JSON.parse(String(init?.body));
      expect(commands[0][0]).toBe("INCR");
      expect(commands[0][1]).toMatch(/^bureauos:rl:shared-key:\d+$/);
      return new Response(JSON.stringify([{ result: count }, { result: 1 }]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await rateLimit("shared-key", 2, 60_000)).toBe(true);
    expect(await rateLimit("shared-key", 2, 60_000)).toBe(true);
    expect(await rateLimit("shared-key", 2, 60_000)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to the in-memory window if the shared backend is unreachable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example-upstash.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await rateLimit("fallback", 1, 60_000)).toBe(true);
    expect(await rateLimit("fallback", 1, 60_000)).toBe(false);
  });
});
