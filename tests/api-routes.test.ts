import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Route-handler integration tests: the real route functions, the real
 * database, real Zod validation — with only session resolution mocked
 * (`getSessionUser`), standing in for the Auth.js JWT the middleware verifies.
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
import { DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL, DISCLAIMER_VERSION } from "@/lib/constants";
import { GET as bootstrapGET } from "@/app/api/bootstrap/route";
import { POST as ticketsPOST } from "@/app/api/tickets/route";
import { POST as ticketActionPOST } from "@/app/api/tickets/[id]/actions/route";
import { POST as reviewsPOST } from "@/app/api/reviews/route";
import { PATCH as filePATCH } from "@/app/api/files/[id]/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let customer: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stranger: any;

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  await wipeDatabase(prisma);
  await seedDatabase(prisma);
  customer = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_CUSTOMER_EMAIL },
    include: { notificationPrefs: true },
  });
  admin = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_ADMIN_EMAIL },
    include: { notificationPrefs: true },
  });
  stranger = await prisma.user.create({
    data: { email: "route-stranger@example.com", name: "Route Stranger", passwordHash: "x", role: "customer" },
    include: { notificationPrefs: true },
  });
});

describe("GET /api/bootstrap scoping & sanitization", () => {
  it("returns only the customer's own rows, with staff-only fields stripped", async () => {
    currentUser = customer;
    const data = await (await bootstrapGET()).json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].email).toBe(DEMO_CUSTOMER_EMAIL);
    expect(data.users[0].passwordHash).toBe("");
    expect(data.cases.length).toBeGreaterThan(0);
    expect(data.cases.every((c: { userId: string }) => c.userId === customer.id)).toBe(true);
    // Seeded insurance case HAS an admin note; seeded ticket HAS an internal
    // note — neither may reach a customer payload.
    expect(data.cases.every((c: { adminNotes: unknown[] }) => c.adminNotes.length === 0)).toBe(true);
    expect(data.tickets.every((t: { internalNotes: unknown[] }) => t.internalNotes.length === 0)).toBe(true);
    expect(data.auditLog).toHaveLength(0);
  });

  it("returns everything (including notes and the audit log) to admins", async () => {
    currentUser = admin;
    const data = await (await bootstrapGET()).json();
    expect(data.users.length).toBeGreaterThanOrEqual(3);
    expect(data.users.every((u: { passwordHash: string }) => u.passwordHash === "")).toBe(true);
    expect(data.cases.some((c: { adminNotes: unknown[] }) => c.adminNotes.length > 0)).toBe(true);
    expect(data.tickets.some((t: { internalNotes: unknown[] }) => t.internalNotes.length > 0)).toBe(true);
    expect(Array.isArray(data.auditLog)).toBe(true);
  });

  it("returns 401 with no session", async () => {
    currentUser = null;
    expect((await bootstrapGET()).status).toBe(401);
  });
});

describe("POST /api/tickets caseId sanitization", () => {
  it("nulls out a crafted caseId pointing at someone else's case", async () => {
    currentUser = stranger;
    const demoCase = await prisma.case.findFirstOrThrow({ where: { userId: customer.id } });
    const res = await ticketsPOST(
      jsonRequest({ caseId: demoCase.id, category: "other", subject: "probe", body: "foreign case attach attempt" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ticket.caseId).toBeNull();
  });

  it("keeps the caseId when the requester owns the case", async () => {
    currentUser = customer;
    const ownCase = await prisma.case.findFirstOrThrow({ where: { userId: customer.id } });
    const res = await ticketsPOST(
      jsonRequest({ caseId: ownCase.id, category: "case_help", subject: "own case", body: "legit" }),
    );
    const data = await res.json();
    expect(data.ticket.caseId).toBe(ownCase.id);
  });
});

describe("ticket actions RBAC", () => {
  it("rejects customer status changes and internal notes; author role is server-derived", async () => {
    currentUser = customer;
    const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { userId: customer.id } });
    const statusRes = await ticketActionPOST(jsonRequest({ type: "set_status", status: "closed" }), params(ticket.id));
    expect(statusRes.status).toBe(403);
    const noteRes = await ticketActionPOST(jsonRequest({ type: "add_internal_note", body: "nope" }), params(ticket.id));
    expect(noteRes.status).toBe(403);
    const msgRes = await ticketActionPOST(jsonRequest({ type: "add_message", body: "customer message" }), params(ticket.id));
    const msgData = await msgRes.json();
    const last = msgData.ticket.messages.at(-1);
    expect(last.authorRole).toBe("customer"); // cannot post as staff
  });

  it("hides foreign tickets from other customers (404)", async () => {
    currentUser = stranger;
    const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { userId: customer.id } });
    const res = await ticketActionPOST(jsonRequest({ type: "add_message", body: "intrusion" }), params(ticket.id));
    expect(res.status).toBe(404);
  });

  it("lets staff set status and writes an audit entry", async () => {
    currentUser = admin;
    const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { userId: customer.id } });
    const res = await ticketActionPOST(jsonRequest({ type: "set_status", status: "in_review" }), params(ticket.id));
    expect(res.status).toBe(200);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "ticket.set_status", targetId: ticket.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.actorRole).toBe("admin");
  });
});

describe("POST /api/reviews enforcement", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is refused outright while human review is not offered — no request is created", async () => {
    currentUser = stranger;
    const kase = await prisma.case.create({
      data: { userId: stranger.id, navigatorSlug: "dmv", title: "review off", serviceTier: "assisted_review" },
    });
    await prisma.disclaimerAcceptance.create({
      data: {
        userId: stranger.id, caseId: kase.id, version: DISCLAIMER_VERSION,
        acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true,
      },
    });
    const res = await reviewsPOST(jsonRequest({ caseId: kase.id, customerNotes: "please review" }));
    expect(res.status).toBe(409);
    expect(await prisma.reviewRequest.count({ where: { caseId: kase.id } })).toBe(0);
  });

  it("rejects reviews on self-service-tier cases (403)", async () => {
    vi.stubEnv("BUREAUOS_HUMAN_REVIEW_ENABLED", "true");
    currentUser = stranger;
    const kase = await prisma.case.create({
      data: { userId: stranger.id, navigatorSlug: "dmv", title: "self-service case", serviceTier: "self_service" },
    });
    const res = await reviewsPOST(jsonRequest({ caseId: kase.id, customerNotes: "please review" }));
    expect(res.status).toBe(403);
  });

  it("rejects reviews without per-case disclaimer acceptance (403)", async () => {
    vi.stubEnv("BUREAUOS_HUMAN_REVIEW_ENABLED", "true");
    currentUser = stranger;
    const kase = await prisma.case.create({
      data: { userId: stranger.id, navigatorSlug: "dmv", title: "no acceptance", serviceTier: "assisted_review" },
    });
    const res = await reviewsPOST(jsonRequest({ caseId: kase.id, customerNotes: "please review" }));
    expect(res.status).toBe(403);
  });

  it("rejects reviews of foreign cases (404)", async () => {
    vi.stubEnv("BUREAUOS_HUMAN_REVIEW_ENABLED", "true");
    currentUser = stranger;
    const demoCase = await prisma.case.findFirstOrThrow({ where: { userId: customer.id } });
    const res = await reviewsPOST(jsonRequest({ caseId: demoCase.id, customerNotes: "not my case" }));
    expect(res.status).toBe(404);
  });

  it("accepts an eligible, accepted, owned case", async () => {
    vi.stubEnv("BUREAUOS_HUMAN_REVIEW_ENABLED", "true");
    currentUser = stranger;
    const kase = await prisma.case.create({
      data: { userId: stranger.id, navigatorSlug: "dmv", title: "eligible case", serviceTier: "assisted_review" },
    });
    await prisma.disclaimerAcceptance.create({
      data: {
        userId: stranger.id, caseId: kase.id, version: DISCLAIMER_VERSION,
        acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true,
      },
    });
    const res = await reviewsPOST(jsonRequest({ caseId: kase.id, customerNotes: "ready for review" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.review.status).toBe("requested");
  });
});

describe("PATCH /api/files RBAC", () => {
  it("rejects customer verification attempts (403) and allows staff (audited)", async () => {
    const file = await prisma.uploadedFile.findFirstOrThrow({ where: { userId: customer.id } });
    currentUser = customer;
    expect((await filePATCH(jsonRequest({ status: "verified" }), params(file.id))).status).toBe(403);
    currentUser = admin;
    const res = await filePATCH(jsonRequest({ status: "verified" }), params(file.id));
    expect(res.status).toBe(200);
    const audit = await prisma.auditLog.findFirst({ where: { action: "file.set_status", targetId: file.id } });
    expect(audit).not.toBeNull();
  });
});
