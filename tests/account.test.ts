import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Account security and privacy: re-authentication for sensitive changes,
 * password change, data export, account and case deletion, and security
 * headers. Real routes, real database; only the session lookup and the
 * outbound Stripe client are replaced.
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

const stripeApi = vi.hoisted(() => ({ create: vi.fn(), expire: vi.fn() }));
vi.mock("@/lib/server/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/stripe")>();
  return {
    ...actual,
    getStripe: () => ({ checkout: { sessions: { create: stripeApi.create, expire: stripeApi.expire } } }),
  };
});

import { prisma } from "@/lib/server/db";
import { wipeDatabase } from "@/lib/server/seed-db";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { checkCredentials } from "@/lib/server/credentials";
import { resetRateLimitMemory } from "@/lib/server/rate-limit";
import { DISCLAIMER_VERSION } from "@/lib/constants";
import { PATCH as mePATCH, DELETE as meDELETE } from "@/app/api/me/route";
import { POST as passwordPOST } from "@/app/api/me/password/route";
import { GET as exportGET } from "@/app/api/me/export/route";
import { DELETE as caseDELETE } from "@/app/api/cases/[id]/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";

const PASSWORD = "original-password-1";
const ADMIN_MFA_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const withPrefs = { notificationPrefs: true } as const;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown, method = "POST") =>
  new Request("http://localhost:3000/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let n = 0;
async function newUser(role: "customer" | "admin" = "customer") {
  n += 1;
  return prisma.user.create({
    data: {
      email: `account-${n}-${role}@example.com`,
      name: `Account User ${n}`,
      passwordHash: hashPassword(PASSWORD),
      role,
      mfaSecret: role === "admin" ? ADMIN_MFA_SECRET : "",
    },
    include: withPrefs,
  });
}
const reload = (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, include: withPrefs });

async function newCase(userId: string, title = "Layoff case") {
  const kase = await prisma.case.create({
    data: {
      userId,
      navigatorSlug: "job-separation",
      title,
      answers: { create: { questionId: "situation_notes", valueJson: JSON.stringify("private intake answer") } },
      letters: { create: { templateId: "final-paycheck-followup", title: "Saved letter", body: "letter body text" } },
      adminNotes: { create: { authorName: "Staff", body: "internal staff-only note" } },
    },
  });
  await prisma.disclaimerAcceptance.create({
    data: {
      userId, caseId: kase.id, version: DISCLAIMER_VERSION,
      acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true,
    },
  });
  return kase;
}

beforeAll(async () => {
  await wipeDatabase(prisma);
});

let sessionSeq = 0;
beforeEach(() => {
  currentUser = null;
  resetRateLimitMemory();
  stripeApi.create.mockReset();
  stripeApi.expire.mockReset();
  stripeApi.expire.mockResolvedValue({});
  stripeApi.create.mockImplementation(async () => ({
    id: `cs_acct_${++sessionSeq}`,
    url: "https://checkout.stripe.test/x",
  }));
});

afterEach(() => vi.unstubAllEnvs());

/* ------------------------------------------------------------------ */

describe("changing the sign-in email requires the current password", () => {
  it("refuses without it or with a wrong one; accepts with the right one", async () => {
    const user = await newUser();
    currentUser = user;
    expect((await mePATCH(json({ email: "new-address@example.com" }, "PATCH"))).status).toBe(403);
    expect((await mePATCH(json({ email: "new-address@example.com", currentPassword: "wrong" }, "PATCH"))).status).toBe(403);
    expect((await reload(user.id)).email).toBe(user.email);

    const ok = await mePATCH(json({ email: "New-Address@Example.com", currentPassword: PASSWORD }, "PATCH"));
    expect(ok.status).toBe(200);
    expect((await reload(user.id)).email).toBe("new-address@example.com");
  });

  it("name and state changes need no password; resubmitting the same email is not a change", async () => {
    const user = await newUser();
    currentUser = user;
    const res = await mePATCH(json({ name: "Renamed", usState: "Florida", email: user.email }, "PATCH"));
    expect(res.status).toBe(200);
    expect(await reload(user.id)).toMatchObject({ name: "Renamed", usState: "Florida", email: user.email });
  });

  it("cannot take another account's email or a reserved demo address", async () => {
    const user = await newUser();
    const other = await newUser();
    currentUser = user;
    expect((await mePATCH(json({ email: other.email, currentPassword: PASSWORD }, "PATCH"))).status).toBe(409);
    expect((await mePATCH(json({ email: "demo@bureauos.app", currentPassword: PASSWORD }, "PATCH"))).status).toBe(409);
    expect((await reload(user.id)).email).toBe(user.email);
  });

  it("throttles password guesses made with a valid session", async () => {
    const user = await newUser();
    currentUser = user;
    let throttled = 0;
    for (let i = 0; i < 12; i++) {
      const res = await mePATCH(json({ email: `guess-${i}@example.com`, currentPassword: `guess-${i}` }, "PATCH"));
      if (res.status === 429) throttled += 1;
      else expect(res.status).toBe(403);
    }
    expect(throttled).toBeGreaterThanOrEqual(4);
    // Even the correct password is refused while throttled.
    expect((await mePATCH(json({ email: "late@example.com", currentPassword: PASSWORD }, "PATCH"))).status).toBe(429);
    expect((await reload(user.id)).email).toBe(user.email);
  });
});

/* ------------------------------------------------------------------ */

describe("POST /api/me/password", () => {
  it("requires the current password and a long-enough, different new one", async () => {
    const user = await newUser();
    currentUser = user;
    expect((await passwordPOST(json({ currentPassword: "wrong", newPassword: "brand-new-password" }))).status).toBe(403);
    expect((await passwordPOST(json({ currentPassword: PASSWORD, newPassword: "short" }))).status).toBe(400);
    expect((await passwordPOST(json({ currentPassword: PASSWORD, newPassword: PASSWORD }))).status).toBe(400);
    const after = await reload(user.id);
    expect(verifyPassword(PASSWORD, after.passwordHash)).toBe(true);
    expect(after.sessionVersion).toBe(0);
  });

  it("changes the password, invalidates existing sessions, and records a security notice", async () => {
    const user = await newUser();
    currentUser = user;
    expect((await passwordPOST(json({ currentPassword: PASSWORD, newPassword: "brand-new-password" }))).status).toBe(200);

    const after = await reload(user.id);
    expect(after.sessionVersion).toBe(1);
    expect(verifyPassword("brand-new-password", after.passwordHash)).toBe(true);
    expect((await checkCredentials(user.email, PASSWORD)).ok).toBe(false);
    expect((await checkCredentials(user.email, "brand-new-password")).ok).toBe(true);
    expect(await prisma.notificationEvent.count({ where: { userId: user.id, type: "account_security" } })).toBe(1);
  });

  it("requires a session", async () => {
    expect((await passwordPOST(json({ currentPassword: PASSWORD, newPassword: "brand-new-password" }))).status).toBe(401);
  });
});

/* ------------------------------------------------------------------ */

describe("GET /api/me/export", () => {
  it("returns the caller's own data as a downloadable file, without secrets or staff notes", async () => {
    const user = await newUser();
    const other = await newUser();
    await newCase(user.id, "My exportable case");
    await newCase(other.id, "Someone else's case");
    await prisma.supportTicket.create({
      data: {
        userId: user.id, category: "other", subject: "My ticket",
        messages: { create: { authorRole: "customer", authorName: user.name, body: "ticket message" } },
        internalNotes: { create: { authorName: "Staff", body: "internal ticket note" } },
      },
    });

    currentUser = user;
    const res = await exportGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="bureauos-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const raw = await res.text();
    const data = JSON.parse(raw);
    expect(data.profile.email).toBe(user.email);
    expect(data.cases).toHaveLength(1);
    expect(data.cases[0].title).toBe("My exportable case");
    expect(data.cases[0].intake.answers.situation_notes).toBe("private intake answer");
    expect(data.cases[0].letters[0].body).toBe("letter body text");
    expect(data.supportTickets[0].messages[0].body).toBe("ticket message");
    expect(data.termsAcceptances).toHaveLength(1);

    expect(raw).not.toContain("Someone else's case");
    expect(raw).not.toContain("scrypt:");
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("mfaSecret");
    expect(raw).not.toContain("internal staff-only note");
    expect(raw).not.toContain("internal ticket note");
  });

  it("an admin's export contains only the admin's own account, not customers'", async () => {
    const customer = await newUser();
    await newCase(customer.id, "Customer-only case title");
    const admin = await newUser("admin");
    currentUser = admin;
    const raw = await (await exportGET()).text();
    expect(JSON.parse(raw).cases).toHaveLength(0);
    expect(raw).not.toContain("Customer-only case title");
    expect(raw).not.toContain(ADMIN_MFA_SECRET);
  });

  it("requires a session and is rate limited per account", async () => {
    expect((await exportGET()).status).toBe(401);
    currentUser = await newUser();
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await exportGET()).status);
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});

/* ------------------------------------------------------------------ */

describe("DELETE /api/me", () => {
  it("requires the password and the typed confirmation", async () => {
    const user = await newUser();
    currentUser = user;
    expect((await meDELETE(json({ password: PASSWORD }, "DELETE"))).status).toBe(400);
    expect((await meDELETE(json({ password: PASSWORD, confirm: "delete" }, "DELETE"))).status).toBe(400);
    expect((await meDELETE(json({ password: "wrong", confirm: "DELETE" }, "DELETE"))).status).toBe(403);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it("removes the account and all its data, keeps anonymized purchase records, leaves others untouched", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_not_a_real_key");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_unit");
    const user = await newUser();
    const bystander = await newUser();
    const kase = await newCase(user.id);
    const pendingCase = await newCase(user.id, "Case with an open checkout");
    const bystanderCase = await newCase(bystander.id);

    const paid = await prisma.purchase.create({
      data: {
        userId: user.id, caseId: kase.id, product: "case_pass", amountCents: 2900, status: "paid",
        livemode: false, stripePaymentIntentId: `pi_delete_${user.id}`,
      },
    });
    await prisma.entitlement.create({
      data: { userId: user.id, caseId: kase.id, product: "case_pass", source: "stripe", purchaseId: paid.id },
    });
    currentUser = user;
    expect((await checkoutPOST(json({ caseId: pendingCase.id }))).status).toBe(200);
    const pending = await prisma.purchase.findFirstOrThrow({ where: { caseId: pendingCase.id } });
    await prisma.supportTicket.create({ data: { userId: user.id, category: "other", subject: "t" } });
    await prisma.notificationEvent.create({
      data: { userId: user.id, type: "welcome", channel: "email", subject: "s", body: "b" },
    });

    const res = await meDELETE(json({ password: PASSWORD, confirm: "DELETE" }, "DELETE"));
    expect(res.status).toBe(200);

    // The open Stripe session was closed so no payment can land afterwards.
    expect(stripeApi.expire).toHaveBeenCalledWith(pending.stripeCheckoutSessionId);

    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    const caseIds = [kase.id, pendingCase.id];
    const remaining = await Promise.all([
      prisma.case.count({ where: { userId: user.id } }),
      prisma.intakeAnswer.count({ where: { caseId: { in: caseIds } } }),
      prisma.generatedLetter.count({ where: { caseId: { in: caseIds } } }),
      prisma.adminNote.count({ where: { caseId: { in: caseIds } } }),
      prisma.entitlement.count({ where: { userId: user.id } }),
      prisma.supportTicket.count({ where: { userId: user.id } }),
      prisma.notificationEvent.count({ where: { userId: user.id } }),
      prisma.disclaimerAcceptance.count({ where: { userId: user.id } }),
      prisma.notificationPreference.count({ where: { userId: user.id } }),
    ]);
    expect(remaining).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Financial records survive with every link to the person removed.
    const kept = await prisma.purchase.findUniqueOrThrow({ where: { id: paid.id } });
    expect(kept).toMatchObject({ userId: null, caseId: null, status: "paid", amountCents: 2900 });
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("expired");

    // The deletion is recorded by id only.
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "account.deleted", targetId: user.id } });
    expect(audit.actorName).toBe("Deleted account");
    expect(JSON.stringify(audit)).not.toContain(user.email);
    expect(JSON.stringify(audit)).not.toContain(user.name);

    // The old credentials no longer work, and nobody else was affected.
    expect((await checkCredentials(user.email, PASSWORD)).ok).toBe(false);
    expect(await prisma.user.count({ where: { id: bystander.id } })).toBe(1);
    expect(await prisma.case.count({ where: { id: bystanderCase.id } })).toBe(1);
  });

  it("staff accounts cannot delete themselves", async () => {
    const admin = await newUser("admin");
    currentUser = admin;
    expect((await meDELETE(json({ password: PASSWORD, confirm: "DELETE" }, "DELETE"))).status).toBe(403);
    expect(await prisma.user.count({ where: { id: admin.id } })).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

describe("DELETE /api/cases/[id]", () => {
  const del = () => new Request("http://localhost:3000/api/cases/x", { method: "DELETE" });

  it("owners delete their own case; other customers get 404", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const kase = await newCase(owner.id);
    currentUser = stranger;
    expect((await caseDELETE(del(), params(kase.id))).status).toBe(404);
    expect(await prisma.case.count({ where: { id: kase.id } })).toBe(1);
    currentUser = owner;
    expect((await caseDELETE(del(), params(kase.id))).status).toBe(200);
    expect(await prisma.case.count({ where: { id: kase.id } })).toBe(0);
    // A customer deleting their own case is not a staff action.
    expect(await prisma.auditLog.count({ where: { action: "case.delete", targetId: kase.id } })).toBe(0);
  });

  it("a staff deletion of a customer's case is audited", async () => {
    const owner = await newUser();
    const admin = await newUser("admin");
    const kase = await newCase(owner.id);
    currentUser = admin;
    expect((await caseDELETE(del(), params(kase.id))).status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "case.delete", targetId: kase.id } });
    expect(audit.actorId).toBe(admin.id);
  });
});

/* ------------------------------------------------------------------ */

describe("security headers", () => {
  it("are set on every route, with a locked-down CSP and no-store on the API", async () => {
    const config = (await import("../next.config.mjs")).default;
    expect(config.headers).toBeTypeOf("function");
    const rules = await config.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const api = rules.find((r) => r.source === "/api/:path*")!;
    expect(all).toBeDefined();
    expect(api).toBeDefined();
    const get = (key: string) => all.headers.find((h) => h.key === key)?.value as string;

    const csp = get("Content-Security-Policy");
    for (const directive of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
    // No third-party origin is allowed to supply script, style, or frames.
    expect(csp).not.toMatch(/https?:\/\//);
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("X-Frame-Options")).toBe("DENY");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(config.poweredByHeader).toBe(false);
    expect(api.headers).toContainEqual({ key: "Cache-Control", value: "no-store" });
  });
});
