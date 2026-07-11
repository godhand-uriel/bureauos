import { prisma } from "@/lib/server/db";
import { notificationToDomain } from "@/lib/server/serializers";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_TYPE_TO_PREF } from "@/lib/constants";
import type { NotificationEvent, NotificationEventType, NotificationPreferences } from "@/lib/types";

/**
 * Server-side mock notification outbox. Honors the recipient's preferences,
 * writes NotificationEvent rows with status "mock_sent" — no real delivery
 * happens in Phase 1. A production worker would drain "queued" rows through
 * Resend/Twilio adapters instead.
 */
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
        data: { userId, type, channel, subject, body, status: "mock_sent" },
      }),
    ),
  );
  return created.map(notificationToDomain);
}
