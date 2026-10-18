import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Email delivery, retries, deadline reminders, the scheduled runner, and
 * password reset. Real database and real route handlers; the email provider
 * is replaced with a recording transport (and, for the Resend adapter test,
 * a stubbed fetch) — nothing leaves the machine.
 */

import { prisma } from "@/lib/server/db";
import { wipeDatabase } from "@/lib/server/seed-db";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { checkCredentials } from "@/lib/server/credentials";
import { resetRateLimitMemory } from "@/lib/server/rate-limit";
import {
  drainNotifications,
  emailTransport,
  queueNotification,
  resendTransport,
  setEmailTransportForTests,
  type EmailMessage,
  type EmailTransport,
  type SendResult,
} from "@/lib/server/notify";
import { queueDeadlineReminders, reminderThreshold } from "@/lib/server/reminders";
import { addDays, dateOnlyToUtcNoon, todayUtc } from "@/lib/dates";
import { GET as runnerGET, POST as runnerPOST } from "@/app/api/internal/notifications/route";
import { POST as resetRequestPOST } from "@/app/api/auth/password-reset/request/route";
import { POST as resetConfirmPOST } from "@/app/api/auth/password-reset/confirm/route";
import { PATCH as prefsPATCH } from "@/app/api/me/notification-prefs/route";

// The prefs route resolves its session through lib/server/auth.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentUser: any = null;
vi.mock("@/lib/server/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    getSessionUser: async () => currentUser,
    unauthorized: () => NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message = "Not found.") => NextResponse.json({ error: message }, { status: 404 }),
    badRequest: (detail: unknown) => NextResponse.json({ error: "Invalid request.", detail }, { status: 400 }),
  };
});

/** Records every message; `next` decides the outcome of the next sends. */
function recordingTransport(kind: EmailTransport["kind"] = "live") {
  const sent: EmailMessage[] = [];
  const outcomes: SendResult[] = [];
  const transport: EmailTransport = {
    kind,
    async send(message) {
      sent.push(message);
      return outcomes.shift() ?? { ok: true, providerMessageId: `msg_${sent.length}` };
    },
  };
  return { transport, sent, next: (...r: SendResult[]) => outcomes.push(...r) };
}

const json = (body: unknown) =>
  new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let seq = 0;
async function newUser(prefs: Partial<Record<string, boolean>> = {}) {
  seq += 1;
  return prisma.user.create({
    data: {
      email: `notify-${seq}@example.com`,
      name: `Notify User ${seq}`,
      passwordHash: hashPassword("original-password-1"),
      notificationPrefs: {
        create: {
          emailReminders: true,
          smsReminders: true, // a stored "yes" must still never produce SMS
          deadlineAlerts: true,
          caseStatusAlerts: true,
          missingDocumentReminders: true,
          supportTicketUpdates: true,
          ...prefs,
        },
      },
    },
    include: { notificationPrefs: true },
  });
}

beforeAll(async () => {
  await wipeDatabase(prisma);
});

beforeEach(() => {
  resetRateLimitMemory();
  currentUser = null;
});

afterEach(() => {
  setEmailTransportForTests(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */

describe("transport selection never pretends to send", () => {
  it("development without a provider records to the local outbox", () => {
    expect(emailTransport().kind).toBe("mock");
  });

  it("production without a provider sends nothing and says so", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(emailTransport().kind).toBe("off");
    const user = await newUser();
    const [event] = await queueNotification(user.id, "welcome", "Welcome", "Hello");
    expect(event.status).toBe("skipped");
    expect(event.sentAt).toBeNull();
  });

  it("uses Resend when both RESEND_API_KEY and EMAIL_FROM are set", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_unit");
    expect(emailTransport().kind).toBe("mock"); // EMAIL_FROM still missing
    vi.stubEnv("EMAIL_FROM", "BureauOS <notify@example.com>");
    expect(emailTransport().kind).toBe("live");
  });
});

describe("Resend adapter", () => {
  it("sends the right request, with an idempotency key, and classifies failures", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const responses = [
      new Response(JSON.stringify({ id: "re_msg_1" }), { status: 200 }),
      new Response("bad from address", { status: 422 }),
      new Response("slow down", { status: 429 }),
      new Response("upstream", { status: 503 }),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return responses.shift()!;
    }));
    const t = resendTransport("re_key", "BureauOS <notify@example.com>");
    const msg = { idempotencyKey: "bureauos-notification-abc", to: "a@example.com", subject: "S", text: "T" };

    expect(await t.send(msg)).toEqual({ ok: true, providerMessageId: "re_msg_1" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_key");
    expect(headers["Idempotency-Key"]).toBe("bureauos-notification-abc");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      from: "BureauOS <notify@example.com>", to: ["a@example.com"], subject: "S", text: "T",
    });

    expect(await t.send(msg)).toMatchObject({ ok: false, retryable: false }); // 422
    expect(await t.send(msg)).toMatchObject({ ok: false, retryable: true }); // 429
    expect(await t.send(msg)).toMatchObject({ ok: false, retryable: true }); // 503

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    expect(await t.send(msg)).toMatchObject({ ok: false, retryable: true });
  });
});

/* ------------------------------------------------------------------ */

describe("queueNotification", () => {
  it("delivers inline, records the provider id, and appends the footer", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    const [event] = await queueNotification(user.id, "support_update", "Reply on your ticket", "Body text");
    expect(event).toMatchObject({ status: "sent", channel: "email" });
    expect(event.sentAt).not.toBeNull();
    expect(rec.sent).toHaveLength(1);
    expect(rec.sent[0].to).toBe(user.email);
    expect(rec.sent[0].idempotencyKey).toBe(`bureauos-notification-${event.id}`);
    expect(rec.sent[0].text).toContain("Body text");
    expect(rec.sent[0].text).toContain("/settings/notifications");
    expect(rec.sent[0].text).toContain("not a law firm");
    const row = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row.providerMessageId).toBe("msg_1");
  });

  it("never creates SMS, honours opt-outs, and always sends account and billing email", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const optedOut = await newUser({ supportTicketUpdates: false });
    expect(await queueNotification(optedOut.id, "support_update", "s", "b")).toEqual([]);

    const noEmail = await newUser({ emailReminders: false });
    expect(await queueNotification(noEmail.id, "deadline_alert", "s", "b")).toEqual([]);
    expect(await queueNotification(noEmail.id, "billing_update", "Receipt", "b")).toHaveLength(1);
    expect(await queueNotification(noEmail.id, "account_security", "Password changed", "b")).toHaveLength(1);

    expect(await prisma.notificationEvent.count({ where: { channel: "sms" } })).toBe(0);
  });

  it("a dedupe key queues a notification only once", async () => {
    setEmailTransportForTests(recordingTransport().transport);
    const user = await newUser();
    expect(await queueNotification(user.id, "deadline_alert", "s", "b", { dedupeKey: "k-once" })).toHaveLength(1);
    expect(await queueNotification(user.id, "deadline_alert", "s", "b", { dedupeKey: "k-once" })).toEqual([]);
    expect(await prisma.notificationEvent.count({ where: { dedupeKey: "k-once" } })).toBe(1);
  });
});

describe("retries", () => {
  it("retries transient failures with backoff, then succeeds", async () => {
    const rec = recordingTransport();
    rec.next({ ok: false, retryable: true, error: "503" });
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    const [event] = await queueNotification(user.id, "welcome", "Welcome", "b");
    expect(event.status).toBe("queued");

    let row = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("503");
    expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    // Not due yet: a drain right now leaves it alone.
    await drainNotifications();
    expect(rec.sent).toHaveLength(1);

    // Later, it goes out.
    const later = new Date(row.nextAttemptAt!.getTime() + 1000);
    await drainNotifications(50, later);
    row = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row).toMatchObject({ status: "sent", attempts: 2, lastError: null, nextAttemptAt: null });
    expect(rec.sent).toHaveLength(2);
    expect(rec.sent[1].idempotencyKey).toBe(rec.sent[0].idempotencyKey); // provider can drop a duplicate
  });

  it("gives up after five attempts, and immediately on a permanent failure", async () => {
    const rec = recordingTransport();
    for (let i = 0; i < 5; i++) rec.next({ ok: false, retryable: true, error: `fail ${i + 1}` });
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    const [event] = await queueNotification(user.id, "welcome", "Welcome", "b");
    let when = new Date();
    for (let i = 0; i < 6; i++) {
      when = new Date(when.getTime() + 24 * 60 * 60 * 1000);
      await drainNotifications(50, when);
    }
    const row = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row).toMatchObject({ status: "failed", attempts: 5, lastError: "fail 5" });

    rec.next({ ok: false, retryable: false, error: "invalid recipient" });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const [permanent] = await queueNotification(user.id, "welcome", "Welcome", "b");
    errors.mockRestore();
    expect(permanent.status).toBe("failed");
  });

  it("a claimed row can't be sent twice by concurrent runners", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    const [event] = await queueNotification(user.id, "welcome", "Welcome", "b", { deliverNow: false });
    await Promise.all([drainNotifications(), drainNotifications(), drainNotifications()]);
    expect(rec.sent.filter((m) => m.idempotencyKey.endsWith(event.id))).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */

describe("deadline reminders", () => {
  it("thresholds: 7, 3, 1 days before and on the day; never after", () => {
    expect([10, 8, 7, 6, 4, 3, 2, 1, 0, -1].map(reminderThreshold)).toEqual([null, null, 7, 7, 7, 3, 3, 1, 0, null]);
  });

  async function caseWithDeadlines(userId: string, status = "in_progress") {
    const today = todayUtc();
    return prisma.case.create({
      data: {
        userId,
        navigatorSlug: "job-separation",
        title: "Layoff — Reminder Test",
        status,
        deadlines: {
          create: [
            { key: "fl-ra-appeal", title: "Appeal the determination", kind: "official", date: dateOnlyToUtcNoon(addDays(today, 3)) },
            { key: "payday", title: "Regular payday", kind: "self_reported", date: dateOnlyToUtcNoon(today) },
            { key: "far", title: "Far-off deadline", kind: "official", date: dateOnlyToUtcNoon(addDays(today, 30)) },
            { key: "followup", title: "Follow up with HR", kind: "suggested", date: dateOnlyToUtcNoon(addDays(today, 1)) },
            { key: "cobra", title: "Elect COBRA", kind: "official", date: null }, // NEEDS VERIFICATION
            { key: "past", title: "Already passed", kind: "official", date: dateOnlyToUtcNoon(addDays(today, -2)) },
          ],
        },
      },
    });
  }

  it("queues one reminder per dated official/self-reported deadline in range, exactly once", async () => {
    setEmailTransportForTests(recordingTransport().transport);
    const user = await newUser();
    await caseWithDeadlines(user.id);

    await queueDeadlineReminders();
    await queueDeadlineReminders(); // the runner calls this every 15 minutes
    const reminders = await prisma.notificationEvent.findMany({ where: { userId: user.id, type: "deadline_alert" } });
    expect(reminders.map((r) => r.subject).sort()).toEqual([
      "Coming up in 3 days: Appeal the determination",
      "Due today: Regular payday",
    ]);
    const appeal = reminders.find((r) => r.subject.includes("Appeal"))!;
    expect(appeal.body).toContain("official notice always controls");
    expect(appeal.body).toContain("/cases/");
    expect(appeal.status).toBe("queued"); // the runner delivers next
  });

  it("skips closed cases and customers who opted out", async () => {
    setEmailTransportForTests(recordingTransport().transport);
    const closedOwner = await newUser();
    await caseWithDeadlines(closedOwner.id, "closed");
    const optedOut = await newUser({ deadlineAlerts: false });
    await caseWithDeadlines(optedOut.id);
    await queueDeadlineReminders();
    expect(await prisma.notificationEvent.count({ where: { userId: { in: [closedOwner.id, optedOut.id] }, type: "deadline_alert" } })).toBe(0);
  });
});

describe("GET/POST /api/internal/notifications (scheduled runner)", () => {
  const req = (method: string, auth?: string) =>
    new Request("http://localhost:3000/api/internal/notifications", {
      method,
      headers: auth ? { authorization: auth } : {},
    });

  it("is off without a CRON_SECRET, and rejects missing or wrong secrets", async () => {
    expect((await runnerGET(req("GET", "Bearer anything"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "short");
    expect((await runnerGET(req("GET", "Bearer short"))).status).toBe(503); // too short to be a real secret
    vi.stubEnv("CRON_SECRET", "a-long-random-cron-secret-value");
    expect((await runnerGET(req("GET"))).status).toBe(401);
    expect((await runnerGET(req("GET", "Bearer wrong-secret-of-similar-length"))).status).toBe(401);
    expect((await runnerPOST(req("POST", "a-long-random-cron-secret-value"))).status).toBe(401); // no "Bearer "
  });

  it("queues due reminders and delivers them", async () => {
    vi.stubEnv("CRON_SECRET", "a-long-random-cron-secret-value");
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    const today = todayUtc();
    await prisma.case.create({
      data: {
        userId: user.id, navigatorSlug: "job-separation", title: "Runner case", status: "in_progress",
        deadlines: { create: { key: "k", title: "Runner deadline", kind: "official", date: dateOnlyToUtcNoon(addDays(today, 1)) } },
      },
    });
    const res = await runnerPOST(req("POST", "Bearer a-long-random-cron-secret-value"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.remindersQueued).toBeGreaterThanOrEqual(1);
    expect(rec.sent.some((m) => m.to === user.email && m.subject === "Coming up tomorrow: Runner deadline")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("password reset", () => {
  function tokenFrom(messages: EmailMessage[], to: string): string {
    const msg = [...messages].reverse().find((m) => m.to === to && m.subject.startsWith("Reset"));
    const match = msg?.text.match(/reset-password\?token=([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("no reset link sent");
    return match[1];
  }

  it("is unavailable when email can't be delivered", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await resetRequestPOST(json({ email: "anyone@example.com" }))).status).toBe(503);
  });

  it("answers the same for known and unknown emails, and only emails real accounts", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    const known = await resetRequestPOST(json({ email: user.email.toUpperCase() }));
    const unknown = await resetRequestPOST(json({ email: "nobody-here@example.com" }));
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(rec.sent.map((m) => m.to)).toEqual([user.email]);
    // Only a hash is stored, and the stored email body no longer holds the link.
    const token = tokenFrom(rec.sent, user.email);
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toContain(token);
    const email = await prisma.notificationEvent.findFirstOrThrow({ where: { userId: user.id, subject: "Reset your BureauOS password" } });
    expect(email.body).not.toContain(token);
    expect(email.sensitive).toBe(true);
  });

  it("sets the new password once, signs out every session, and voids the link", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    await resetRequestPOST(json({ email: user.email }));
    const token = tokenFrom(rec.sent, user.email);

    expect((await resetConfirmPOST(json({ token, newPassword: "short" }))).status).toBe(400);
    expect((await resetConfirmPOST(json({ token, newPassword: "a-brand-new-password" }))).status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verifyPassword("a-brand-new-password", after.passwordHash)).toBe(true);
    expect(after.sessionVersion).toBe(user.sessionVersion + 1);
    expect((await checkCredentials(user.email, "original-password-1")).ok).toBe(false);
    expect(rec.sent.some((m) => m.to === user.email && m.subject === "Your BureauOS password was reset")).toBe(true);

    // Single use.
    expect((await resetConfirmPOST(json({ token, newPassword: "another-new-password" }))).status).toBe(400);
  });

  it("rejects expired, unknown, and superseded links", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();

    await resetRequestPOST(json({ email: user.email }));
    const first = tokenFrom(rec.sent, user.email);
    await resetRequestPOST(json({ email: user.email }));
    const second = tokenFrom(rec.sent, user.email);
    expect(second).not.toBe(first);
    expect((await resetConfirmPOST(json({ token: first, newPassword: "a-brand-new-password" }))).status).toBe(400);

    await prisma.passwordResetToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await resetConfirmPOST(json({ token: second, newPassword: "a-brand-new-password" }))).status).toBe(400);
    expect((await resetConfirmPOST(json({ token: "x".repeat(43), newPassword: "a-brand-new-password" }))).status).toBe(400);
    expect(verifyPassword("original-password-1", (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash)).toBe(true);
  });

  it("limits reset emails per address", async () => {
    const rec = recordingTransport();
    setEmailTransportForTests(rec.transport);
    const user = await newUser();
    for (let i = 0; i < 6; i++) await resetRequestPOST(json({ email: user.email }));
    expect(rec.sent.filter((m) => m.to === user.email && m.subject.startsWith("Reset"))).toHaveLength(3);
  });
});

describe("notification preferences", () => {
  it("SMS and missing-document reminders can't be switched on", async () => {
    const user = await newUser({ smsReminders: false, missingDocumentReminders: false });
    currentUser = user;
    const res = await prefsPATCH(new Request("http://localhost:3000/api/me/notification-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsReminders: true, missingDocumentReminders: true, deadlineAlerts: false }),
    }));
    expect(res.status).toBe(200);
    const prefs = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: user.id } });
    expect(prefs).toMatchObject({ smsReminders: false, missingDocumentReminders: false, deadlineAlerts: false });
  });
});
