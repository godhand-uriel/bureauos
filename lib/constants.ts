import type { NotificationEventType, NotificationPreferences } from "@/lib/types";

/**
 * Shared client/server constants. Keep this module free of "use client" and
 * server-only imports — it is used by React components, API routes, and the
 * seed script alike.
 */

/**
 * Bump when the Terms, Privacy Policy or Disclaimer change materially: every
 * case asks for acceptance again, and earlier acceptance rows keep the
 * version they were given, so each record still names the text accepted.
 *   2026-07-07.v1  original MVP drafts
 *   2026-10-18.v2  launch drafts (Case Pass, payments, privacy controls) — as BureauOS
 *   2026-10-18.v3  the same documents under the Building202 name
 */
export const DISCLAIMER_VERSION = "2026-10-18.v3";

export const DEMO_CUSTOMER_EMAIL = "demo@bureauos.app";
export const DEMO_ADMIN_EMAIL = "admin@bureauos.app";
export const DEMO_PASSWORD = "bureau-demo";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  emailReminders: true,
  smsReminders: false,
  deadlineAlerts: true,
  caseStatusAlerts: true,
  missingDocumentReminders: true,
  supportTicketUpdates: true,
};

/** Which preference toggle governs each notification type (null = always delivered). */
export const NOTIFICATION_TYPE_TO_PREF: Record<
  NotificationEventType,
  keyof NotificationPreferences | null
> = {
  deadline_alert: "deadlineAlerts",
  case_status: "caseStatusAlerts",
  missing_document: "missingDocumentReminders",
  support_update: "supportTicketUpdates",
  review_update: "caseStatusAlerts",
  billing_update: null,
  account_security: null,
  welcome: null,
};
