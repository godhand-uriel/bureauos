import { Prisma, type NotificationEvent as DbNotification } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { notificationToDomain } from "@/lib/server/serializers";
import { appOrigin, emailConfigured, isProduction } from "@/lib/server/commerce";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_TYPE_TO_PREF } from "@/lib/constants";
import type { NotificationEvent, NotificationEventType, NotificationPreferences } from "@/lib/types";

/**
 * Outbound notifications — email only.
 *
 * Every notification is written as a "queued" row first, then delivered:
 * once inline (so most emails go out within the request), and again by the
 * scheduled runner (/api/internal/notifications) for anything that failed
 * transiently. What "delivered" means depends on configuration, and the row
 * always says which one happened:
 *
 *   RESEND_API_KEY + EMAIL_FROM set   → sent through Resend      → "sent" / retried / "failed"
 *   not set, development              → recorded locally only    → "mock_sent"
 *   not set, production               → not sent, said plainly   → "skipped"
 *
 * SMS is not offered: no SMS rows are ever created, whatever the stored
 * preference says.
 */

const MAX_ATTEMPTS = 5;
/** Minutes to wait before attempt n+1 (index = attempts already made). */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
/** How long a claimed row is held so a crashed send is retried, not lost. */
const CLAIM_MINUTES = 10;
const SEND_TIMEOUT_MS = 8_000;
const SCRUBBED_BODY = "[This message contained a one-time link and was cleared after sending.]";

export interface EmailMessage {
  /** Stable per notification — the provider uses it to drop duplicate sends. */
  idempotencyKey: string;
  to: string;
  subject: string;
  text: string;
}

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; retryable: boolean; error: string };

export interface EmailTransport {
  /** "live" really sends; "mock" records only (development); "off" sends nothing. */
  kind: "live" | "mock" | "off";
  send(message: EmailMessage): Promise<SendResult>;
}

/** Resend over its REST API — no SDK dependency. */
export function resendTransport(apiKey: string, from: string): EmailTransport {
  return {
    kind: "live",
    async send(message) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { id?: string };
          return { ok: true, providerMessageId: data.id ?? null };
        }
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        // 429 and 5xx are worth retrying; any other 4xx will fail the same way again.
        const retryable = res.status === 429 || res.status >= 500;
        return { ok: false, retryable, error: `Resend ${res.status}: ${detail}` };
      } catch (err) {
        return { ok: false, retryable: true, error: err instanceof Error ? err.message : "network error" };
      }
    },
  };
}

const mockTransport: EmailTransport = {
  kind: "mock",
  async send(message) {
    // Development only — makes local flows (e.g. a reset link) usable without a provider.
    console.info(`[bureauos] (development email, not sent) to=${message.to} subject="${message.subject}"\n${message.text}`);
    return { ok: true, providerMessageId: null };
  },
};

const offTransport: EmailTransport = {
  kind: "off",
  async send() {
    return { ok: false, retryable: false, error: "Email delivery is not configured." };
  },
};

let override: EmailTransport | null = null;
/** Test hook: substitute the transport (pass null to restore). */
export function setEmailTransportForTests(transport: EmailTransport | null): void {
  override = transport;
}

export function emailTransport(): EmailTransport {
  if (override) return override;
  if (emailConfigured()) return resendTransport(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM!);
  return isProduction() ? offTransport : mockTransport;
}

function emailText(body: string): string {
  const settings = `${appOrigin()}/settings/notifications`;
  return `${body}\n\n—\nBuilding202 · You're receiving this because you have a Building202 account.\nChoose which emails you get: ${settings}\nBuilding202 is self-service software. It is not a law firm and does not give legal advice.`;
}

function prefsFrom(p: Prisma.NotificationPreferenceGetPayload<object> | null): NotificationPreferences {
  return p
    ? {
        emailReminders: p.emailReminders,
        smsReminders: false,
        deadlineAlerts: p.deadlineAlerts,
        caseStatusAlerts: p.caseStatusAlerts,
        missingDocumentReminders: p.missingDocumentReminders,
        supportTicketUpdates: p.supportTicketUpdates,
      }
    : { ...DEFAULT_NOTIFICATION_PREFS };
}

/* ------------------------------ delivery ------------------------------ */

/**
 * Attempt delivery of one queued row. The row is claimed first (attempts+1,
 * held for CLAIM_MINUTES), so two runners can never send it at the same time,
 * and a crash mid-send leaves it to be retried rather than lost.
 */
async function deliverOne(id: string, transport: EmailTransport, now = new Date()): Promise<void> {
  const claimed = await prisma.notificationEvent.updateMany({
    where: { id, status: "queued", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + CLAIM_MINUTES * 60_000) },
  });
  if (claimed.count === 0) return;

  const event = await prisma.notificationEvent.findUnique({ where: { id }, include: { user: true } });
  if (!event) return;

  const settle = (data: Prisma.NotificationEventUpdateInput) =>
    prisma.notificationEvent.update({
      where: { id },
      data: { ...data, ...(event.sensitive && data.status !== "queued" ? { body: SCRUBBED_BODY } : {}) },
    });

  if (transport.kind === "off") {
    await settle({ status: "skipped", nextAttemptAt: null, lastError: "Email delivery is not configured." });
    return;
  }

  const result = await transport.send({
    idempotencyKey: `bureauos-notification-${event.id}`,
    to: event.user.email,
    subject: event.subject,
    text: emailText(event.body),
  });

  if (result.ok) {
    await settle({
      status: transport.kind === "mock" ? "mock_sent" : "sent",
      sentAt: new Date(),
      providerMessageId: result.providerMessageId,
      nextAttemptAt: null,
      lastError: null,
    });
    return;
  }

  const outOfAttempts = event.attempts >= MAX_ATTEMPTS;
  if (!result.retryable || outOfAttempts) {
    console.error("[bureauos] email delivery failed", { id, attempts: event.attempts, error: result.error });
    await settle({ status: "failed", nextAttemptAt: null, lastError: result.error });
    return;
  }
  const wait = BACKOFF_MINUTES[Math.min(event.attempts - 1, BACKOFF_MINUTES.length - 1)];
  await settle({
    status: "queued",
    nextAttemptAt: new Date(Date.now() + wait * 60_000),
    lastError: result.error,
  });
}

/** Deliver everything that is due. Called by the scheduled runner. */
export async function drainNotifications(
  limit = 50,
  now = new Date(),
): Promise<{ attempted: number; sent: number; failed: number; requeued: number }> {
  const transport = emailTransport();
  const due = await prisma.notificationEvent.findMany({
    where: { status: "queued", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const { id } of due) {
    try {
      await deliverOne(id, transport, now);
    } catch (err) {
      console.error("[bureauos] notification delivery error", { id, message: err instanceof Error ? err.message : "unknown" });
    }
  }
  const ids = due.map((d) => d.id);
  const after = await prisma.notificationEvent.groupBy({ by: ["status"], where: { id: { in: ids } }, _count: true });
  const count = (status: string) => after.find((a) => a.status === status)?._count ?? 0;
  return {
    attempted: ids.length,
    sent: count("sent") + count("mock_sent"),
    failed: count("failed") + count("skipped"),
    requeued: count("queued"),
  };
}

/* ------------------------------- queueing ------------------------------ */

interface QueueOptions {
  /** The body contains a secret; it is cleared once delivery settles. */
  sensitive?: boolean;
  /** Skip if a notification with this key already exists. */
  dedupeKey?: string;
  /** Deliver inline right away (default) — the runner retries failures. */
  deliverNow?: boolean;
}

/**
 * Queue an email for a user, honouring their preferences, and try to deliver
 * it immediately. Never throws for delivery problems: a failed send stays
 * queued for the runner, and the caller's own action is not affected.
 */
export async function queueNotification(
  userId: string,
  type: NotificationEventType,
  subject: string,
  body: string,
  options: QueueOptions = {},
): Promise<NotificationEvent[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { notificationPrefs: true } });
  if (!user) return [];

  const prefs = prefsFrom(user.notificationPrefs);
  const prefKey = NOTIFICATION_TYPE_TO_PREF[type];
  // Types with no preference key (welcome, billing, account security) always go.
  if (prefKey && (!prefs.emailReminders || !prefs[prefKey])) return [];

  let created: DbNotification;
  try {
    created = await prisma.notificationEvent.create({
      data: {
        userId,
        type,
        channel: "email",
        subject,
        body,
        status: "queued",
        sensitive: options.sensitive ?? false,
        dedupeKey: options.dedupeKey ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && options.dedupeKey) {
      return []; // already queued (or sent) once — that's the point of the key
    }
    throw err;
  }

  if (options.deliverNow !== false) {
    try {
      await deliverOne(created.id, emailTransport());
    } catch (err) {
      console.error("[bureauos] inline delivery error", { id: created.id, message: err instanceof Error ? err.message : "unknown" });
    }
  }
  const current = await prisma.notificationEvent.findUnique({ where: { id: created.id } });
  return current ? [notificationToDomain(current)] : [];
}
