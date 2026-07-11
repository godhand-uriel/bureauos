import type { Prisma } from "@prisma/client";
import type {
  ActionPlan,
  AdminNote,
  AnswerValue,
  Case,
  CaseStatus,
  DisclaimerAcceptance,
  DocumentStatus,
  FileCategory,
  FileStatus,
  NavigatorSlug,
  NotificationEvent,
  NotificationEventType,
  NotificationPreferences,
  Priority,
  ReviewRequest,
  ReviewStatus,
  ServiceTierId,
  Subscription,
  SupportTicket,
  TicketCategory,
  TicketStatus,
  TimelineEventType,
  UploadedFile,
  User,
} from "@/lib/types";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/constants";

/**
 * Domain ⇄ database mapping.
 *
 * The SQLite schema stores enum-like fields as String columns holding the
 * exact domain values, and JSON-shaped fields as serialized strings — so
 * mapping is mostly date conversion, JSON parsing, and (critically) response
 * sanitization: passwordHash never leaves the server, and staff-only notes
 * are stripped from customer-facing payloads.
 */

/* ------------------------------- includes ------------------------------ */

export const caseInclude = {
  answers: true,
  plan: true,
  tasks: { orderBy: { createdAt: "asc" as const } },
  documents: true,
  deadlines: { orderBy: { date: "asc" as const } },
  letters: { orderBy: { createdAt: "desc" as const } },
  timeline: { orderBy: { date: "asc" as const } },
  adminNotes: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CaseInclude;

export type DbCase = Prisma.CaseGetPayload<{ include: typeof caseInclude }>;

export const ticketInclude = {
  messages: { orderBy: { createdAt: "asc" as const } },
  internalNotes: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.SupportTicketInclude;

export type DbTicket = Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }>;

export const reviewInclude = {
  reviewerNotes: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReviewRequestInclude;

export type DbReview = Prisma.ReviewRequestGetPayload<{ include: typeof reviewInclude }>;

export const subscriptionInclude = {
  payments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.SubscriptionInclude;

export type DbSubscription = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionInclude }>;

export type DbUserWithPrefs = Prisma.UserGetPayload<{ include: { notificationPrefs: true } }>;

/* ------------------------------ to domain ------------------------------ */

const iso = (d: Date) => d.toISOString();

export function userToDomain(u: DbUserWithPrefs): User {
  const p = u.notificationPrefs;
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
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    passwordHash: "", // never serialized to clients
    role: u.role as User["role"],
    usState: u.usState,
    phone: u.phone,
    createdAt: iso(u.createdAt),
    notificationPrefs: prefs,
  };
}

function noteToDomain(n: DbCase["adminNotes"][number]): AdminNote {
  return { id: n.id, authorName: n.authorName, body: n.body, createdAt: iso(n.createdAt) };
}

export function caseToDomain(c: DbCase, opts: { includeAdminNotes: boolean }): Case {
  const answers: Record<string, AnswerValue> = {};
  for (const a of c.answers) {
    try {
      answers[a.questionId] = JSON.parse(a.valueJson) as AnswerValue;
    } catch {
      answers[a.questionId] = null;
    }
  }
  const plan: ActionPlan | null = c.plan
    ? {
        generatedAt: iso(c.plan.generatedAt),
        situationSummary: c.plan.situationSummary,
        priority: c.plan.priority as Priority,
        nextActions: JSON.parse(c.plan.nextActionsJson),
        riskFlags: JSON.parse(c.plan.riskFlagsJson),
        suggestedLetterTemplateId: c.plan.suggestedLetterTemplateId ?? undefined,
        disclaimer: c.plan.disclaimer,
      }
    : null;
  return {
    id: c.id,
    userId: c.userId,
    navigatorSlug: c.navigatorSlug as NavigatorSlug,
    title: c.title,
    status: c.status as CaseStatus,
    priority: c.priority as Priority,
    serviceTier: c.serviceTier as ServiceTierId,
    assignedTo: c.assignedTo,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
    intake: { answers, currentStep: c.intakeStep, completed: c.intakeCompleted },
    plan,
    tasks: c.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      category: t.category ?? undefined,
      done: t.done,
      dueDate: t.dueDate ? iso(t.dueDate) : undefined,
      createdAt: iso(t.createdAt),
    })),
    documents: c.documents.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description ?? undefined,
      required: d.required,
      status: d.status as DocumentStatus,
    })),
    deadlines: c.deadlines.map((d) => ({
      id: d.id,
      title: d.title,
      date: iso(d.date),
      note: d.note ?? undefined,
      verified: d.verified,
    })),
    letters: c.letters.map((l) => ({
      id: l.id,
      templateId: l.templateId,
      title: l.title,
      body: l.body,
      createdAt: iso(l.createdAt),
      updatedAt: iso(l.updatedAt),
    })),
    timeline: c.timeline.map((e) => ({
      id: e.id,
      type: e.type as TimelineEventType,
      title: e.title,
      detail: e.detail ?? undefined,
      date: iso(e.date),
    })),
    adminNotes: opts.includeAdminNotes ? c.adminNotes.map(noteToDomain) : [],
  };
}

export function ticketToDomain(t: DbTicket, opts: { includeInternalNotes: boolean }): SupportTicket {
  return {
    id: t.id,
    userId: t.userId,
    caseId: t.caseId,
    category: t.category as TicketCategory,
    subject: t.subject,
    status: t.status as TicketStatus,
    messages: t.messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole as "customer" | "staff",
      authorName: m.authorName,
      body: m.body,
      createdAt: iso(m.createdAt),
    })),
    internalNotes: opts.includeInternalNotes ? t.internalNotes.map(noteToDomain) : [],
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

export function reviewToDomain(r: DbReview): ReviewRequest {
  return {
    id: r.id,
    caseId: r.caseId,
    userId: r.userId,
    status: r.status as ReviewStatus,
    customerNotes: r.customerNotes,
    reviewerNotes: r.reviewerNotes.map(noteToDomain),
    requestedAt: iso(r.requestedAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function fileToDomain(f: Prisma.UploadedFileGetPayload<object>): UploadedFile {
  return {
    id: f.id,
    caseId: f.caseId,
    userId: f.userId,
    name: f.name,
    fileType: f.fileType,
    sizeLabel: f.sizeLabel,
    category: f.category as FileCategory,
    uploadedAt: iso(f.uploadedAt),
    status: f.status as FileStatus,
    notes: f.notes,
  };
}

export function subscriptionToDomain(s: DbSubscription): Subscription {
  return {
    id: s.id,
    userId: s.userId,
    tier: s.tier as ServiceTierId,
    status: s.status as Subscription["status"],
    startedAt: iso(s.startedAt),
    updatedAt: iso(s.updatedAt),
    history: s.payments.map((p) => ({
      id: p.id,
      label: p.label,
      amountLabel: p.amountLabel,
      date: iso(p.createdAt),
      kind: p.kind as Subscription["history"][number]["kind"],
    })),
  };
}

export function acceptanceToDomain(a: Prisma.DisclaimerAcceptanceGetPayload<object>): DisclaimerAcceptance {
  return {
    id: a.id,
    userId: a.userId,
    caseId: a.caseId,
    version: a.version,
    acceptedTerms: a.acceptedTerms,
    acceptedPrivacy: a.acceptedPrivacy,
    acceptedDisclaimer: a.acceptedDisclaimer,
    acceptedAt: iso(a.acceptedAt),
  };
}

export function notificationToDomain(n: Prisma.NotificationEventGetPayload<object>): NotificationEvent {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type as NotificationEventType,
    channel: n.channel as "email" | "sms",
    subject: n.subject,
    body: n.body,
    createdAt: iso(n.createdAt),
    status: n.status as NotificationEvent["status"],
  };
}

/* ------------------------------ to database ---------------------------- */

/** Nested create payload for inserting a full domain Case (used by seed + create flows). */
export function caseToCreateData(c: Case): Prisma.CaseCreateInput {
  return {
    id: c.id,
    user: { connect: { id: c.userId } },
    navigatorSlug: c.navigatorSlug,
    title: c.title,
    status: c.status,
    priority: c.priority,
    serviceTier: c.serviceTier,
    assignedTo: c.assignedTo,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    intakeCompleted: c.intake.completed,
    intakeStep: c.intake.currentStep,
    answers: {
      create: Object.entries(c.intake.answers).map(([questionId, value]) => ({
        questionId,
        valueJson: JSON.stringify(value ?? null),
      })),
    },
    plan: c.plan
      ? {
          create: {
            generatedAt: new Date(c.plan.generatedAt),
            situationSummary: c.plan.situationSummary,
            priority: c.plan.priority,
            nextActionsJson: JSON.stringify(c.plan.nextActions),
            riskFlagsJson: JSON.stringify(c.plan.riskFlags),
            suggestedLetterTemplateId: c.plan.suggestedLetterTemplateId ?? null,
            disclaimer: c.plan.disclaimer,
          },
        }
      : undefined,
    tasks: {
      create: c.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? null,
        category: t.category ?? null,
        done: t.done,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        createdAt: new Date(t.createdAt),
      })),
    },
    documents: {
      create: c.documents.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? null,
        required: d.required,
        status: d.status,
      })),
    },
    deadlines: {
      create: c.deadlines.map((d) => ({
        id: d.id,
        title: d.title,
        date: new Date(d.date),
        note: d.note ?? null,
        verified: d.verified,
      })),
    },
    letters: {
      create: c.letters.map((l) => ({
        id: l.id,
        templateId: l.templateId,
        title: l.title,
        body: l.body,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      })),
    },
    timeline: {
      create: c.timeline.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        detail: e.detail ?? null,
        date: new Date(e.date),
      })),
    },
    adminNotes: {
      create: c.adminNotes.map((n) => ({
        id: n.id,
        authorName: n.authorName,
        body: n.body,
        createdAt: new Date(n.createdAt),
      })),
    },
  };
}
