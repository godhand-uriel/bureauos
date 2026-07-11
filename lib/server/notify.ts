import { prisma } from "@/lib/server/db";
import { notificationToDomain } from "@/lib/server/serializers";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_TYPE_TO_PREF } from "@/lib/constants";
import type { NotificationEvent, NotificationEventType, NotificationPreferences } from "@/lib/types";

/**
 * Notification outbox pipeline: events are written as "queued", then handed
 * to a transport that marks them delivered. Locally the MockTransport
 * "delivers" immediately (status → "mock_sent", nothing actually sent).
 *
 * Production swaps the transport for Resend/SendGrid (email) and Twilio/SNS
 * (sms) behind the same interface, and moves `deliverQueued` into a
 * background worker draining the queue instead of the inline call below.
 */

export interface NotificationTransport {
  /** Deliver one event; returns the resulting status. */
  deliver(event: { channel: string; subject: string; body: string; userId: string }): Promise<"mock_sent" | "queued">;
}

/** Local development transport: no external calls, marks events mock_sent. */
const mockTransport: NotificationTransport = {
  async deliver() {
    return "mock_sent";
  },
};

async function deliverQueued(ids: string[], transport: NotificationTransport): Promise<void> {
  const queued = await prisma.notificationEvent.findMany({ where: { id: { in: ids }, status: "queued" } });
  for (const event of queued) {
    const status = await transport.deliver(event);
    if (status !== "queued") {
      await prisma.notificationEvent.update({ where: { id: event.id }, data: { status } });
    }
  }
}

/** Queue notification(s) for a user, honoring their preferences, then run the transport. */
export async function queueNotification(
  userId: string,
  type: NotificationEventType,
  subject: string,
  body: string,
): Promise<NotificationEvent[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPrefs: true },
  });
  if (!user) return [];

  const p = user.notificationPrefs;
  const prefs: NotificationPreferences = p
    ? {
        emailReminders: p.emailReminders,
        smsReminders: p.smsReminders,
        deadlineAlerts: p.deadlineAlerts,
        caseStatusAlerts: p.caseStatusAlerts,
        missingDocumentReminders: p.missingDocumentReminders,
        supportTicketUpdates: p.supportTicketUpdates,
      }
    : { ...DEFAULT_NOTIFICATION_PREFS };

  const prefKey = NOTIFICATION_TYPE_TO_PREF[type];
  if (prefKey && !prefs[prefKey]) return [];

  const channels: ("email" | "sms")[] = [];
  if (prefs.emailReminders || !prefKey) channels.push("email");
  if (prefs.smsReminders && prefKey) channels.push("sms");

  const created = await Promise.all(
    channels.map((channel) =>
      prisma.notificationEvent.create({
        data: { userId, type, channel, subject, body, status: "queued" },
      }),
    ),
  );

  // Inline delivery locally; a worker owns this in production.
  await deliverQueued(created.map((e) => e.id), mockTransport);

  const delivered = await prisma.notificationEvent.findMany({
    where: { id: { in: created.map((e) => e.id) } },
  });
  return delivered.map(notificationToDomain);
}
