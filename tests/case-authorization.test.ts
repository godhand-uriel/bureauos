import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/db";
import { seedDatabase, wipeDatabase } from "@/lib/server/seed-db";
import { performCaseAction } from "@/lib/server/case-actions";
import type { SessionUser } from "@/lib/server/auth";
import { DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL, DISCLAIMER_VERSION } from "@/lib/constants";

/**
 * Ownership + RBAC rules of the case mutation service, exercised against a
 * real (test) database — no HTTP, no mocks: performCaseAction is the exact
 * function the API route calls after validation.
 */

let customer: SessionUser;
let admin: SessionUser;
let stranger: SessionUser;
let ownCaseId: string;

beforeAll(async () => {
  await wipeDatabase(prisma);
  await seedDatabase(prisma);
  customer = (await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_CUSTOMER_EMAIL },
    include: { notificationPrefs: true },
  })) as SessionUser;
  admin = (await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_ADMIN_EMAIL },
    include: { notificationPrefs: true },
  })) as SessionUser;
  stranger = (await prisma.user.create({
    data: { email: "stranger@example.com", name: "Stranger", passwordHash: "x", role: "customer" },
    include: { notificationPrefs: true },
  })) as SessionUser;
  ownCaseId = (await prisma.case.findFirstOrThrow({ where: { userId: customer.id } })).id;
});

describe("case ownership", () => {
  it("lets the owner mutate their own case", async () => {
    const task = await prisma.task.findFirstOrThrow({ where: { caseId: ownCaseId, done: false } });
    const result = await performCaseAction(customer, ownCaseId, { type: "toggle_task", taskId: task.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.case.tasks.find((t) => t.id === task.id)?.done).toBe(true);
    }
    // restore
    await performCaseAction(customer, ownCaseId, { type: "toggle_task", taskId: task.id });
  });

  it("returns 404 (not 403) when a stranger touches a foreign case, so ids can't be probed", async () => {
    const result = await performCaseAction(stranger, ownCaseId, {
      type: "add_task",
      id: "probe-task-0001",
      title: "should never exist",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
    expect(await prisma.task.findUnique({ where: { id: "probe-task-0001" } })).toBeNull();
  });

  it("lets an admin operate on any customer's case", async () => {
    const result = await performCaseAction(admin, ownCaseId, { type: "assign", staffName: "Alex Reyes" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.case.assignedTo).toBe("Alex Reyes");
  });
});

describe("admin-only actions", () => {
  it("rejects internal notes from customers with 403", async () => {
    const result = await performCaseAction(customer, ownCaseId, {
      type: "add_admin_note",
      id: "probe-note-0001",
      body: "customer should not write staff notes",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("rejects assignment from customers with 403", async () => {
    const result = await performCaseAction(customer, ownCaseId, { type: "assign", staffName: "Me" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("accepts internal notes from admins and writes an audit entry", async () => {
    const before = await prisma.auditLog.count({ where: { action: "case.add_internal_note" } });
    const result = await performCaseAction(admin, ownCaseId, {
      type: "add_admin_note",
      id: "staff-note-0001",
      body: "verified during integration tests",
    });
    expect(result.ok).toBe(true);
    const after = await prisma.auditLog.count({ where: { action: "case.add_internal_note" } });
    expect(after).toBe(before + 1);
  });
});

describe("disclaimer acceptance gating", () => {
  it("blocks complete_intake without a per-case acceptance", async () => {
    const kase = await prisma.case.create({
      data: { userId: stranger.id, navigatorSlug: "dmv", title: "no-acceptance case" },
    });
    const result = await performCaseAction(stranger, kase.id, { type: "complete_intake" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("allows complete_intake after acceptance and generates a plan server-side", async () => {
    const kase = await prisma.case.create({
      data: {
        userId: stranger.id,
        navigatorSlug: "dmv",
        title: "accepted case",
        answers: {
          create: [
            { questionId: "issue_type", valueJson: JSON.stringify("renewal") },
            { questionId: "state", valueJson: JSON.stringify("Texas") },
          ],
        },
      },
    });
    await prisma.disclaimerAcceptance.create({
      data: {
        userId: stranger.id,
        caseId: kase.id,
        version: DISCLAIMER_VERSION,
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedDisclaimer: true,
      },
    });
    const result = await performCaseAction(stranger, kase.id, { type: "complete_intake" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.case.plan).not.toBeNull();
      expect(result.case.plan?.situationSummary).toContain("Texas");
      expect(result.case.tasks.length).toBeGreaterThan(0);
      expect(result.case.intake.completed).toBe(true);
    }
  });

  it("blocks save_letter for customers without acceptance", async () => {
    const kase = await prisma.case.create({
      data: { userId: stranger.id, navigatorSlug: "tenant-rights", title: "letter gate case" },
    });
    const result = await performCaseAction(stranger, kase.id, {
      type: "save_letter",
      id: "probe-letter-01",
      templateId: "tenant-repair-request",
      title: "Repair letter",
      letterBody: "test body",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

describe("staff status changes", () => {
  it("marks staff-actor status changes on the timeline and notifies the customer", async () => {
    const result = await performCaseAction(admin, ownCaseId, { type: "set_status", status: "waiting" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const evt = [...result.case.timeline].reverse().find((e) => e.type === "status_change");
      expect(evt?.detail).toBe("Updated by BureauOS staff.");
      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.notifications[0].userId).toBe(customer.id);
      expect(result.notifications[0].status).toBe("mock_sent");
    }
    const audit = await prisma.auditLog.findFirst({
      where: { action: "case.set_status", targetId: ownCaseId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.actorId).toBe(admin.id);
  });
});
