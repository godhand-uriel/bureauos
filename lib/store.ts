"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AnswerValue,
  Case,
  CaseStatus,
  DisclaimerAcceptance,
  DocumentStatus,
  FileCategory,
  GeneratedLetter,
  NavigatorSlug,
  NotificationEvent,
  NotificationEventType,
  NotificationPreferences,
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
  UserRole,
} from "@/lib/types";
import { legacyPersistedStateSchema, persistedStateSchema } from "@/lib/schemas";
import { generatePlanForCase } from "@/lib/plan-engine";
import { getNavigator } from "@/lib/navigators";
import { buildSeedCases } from "@/lib/seed";
import { getTier } from "@/lib/packages";
import { uid, daysFromNow } from "@/lib/utils";

/**
 * BureauOS local-first data layer (v2 — user-scoped platform shape).
 *
 * Persistence today: zustand + localStorage, validated with Zod on rehydrate.
 * The entity shapes mirror prisma/schema.prisma so this layer can be replaced
 * by API routes + Prisma/Postgres (or Supabase) without changing components:
 * components only call these actions/selectors, never storage directly.
 *
 * Auth today: a demo-grade local abstraction (see AUTH note below). The
 * session/user model matches what Clerk / Supabase Auth / Auth.js provide,
 * so swapping providers replaces signUp/logIn/logOut and useCurrentUser only.
 */

export const DISCLAIMER_VERSION = "2026-07-07.v1";

export const DEMO_CUSTOMER_ID = "user-demo-customer";
export const DEMO_ADMIN_ID = "user-demo-admin";
export const DEMO_CUSTOMER_EMAIL = "demo@bureauos.app";
export const DEMO_ADMIN_EMAIL = "admin@bureauos.app";
export const DEMO_PASSWORD = "bureau-demo";

/**
 * AUTH NOTE: demo-grade, non-cryptographic hash so seeded demo accounts work
 * offline. NEVER ship this to production — replace the whole auth module with
 * Clerk, Supabase Auth, or Auth.js (see README → Authentication).
 */
export function demoHash(password: string): string {
  let h = 5381;
  for (let i = 0; i < password.length; i++) {
    h = (h * 33) ^ password.charCodeAt(i);
  }
  return `demo:${(h >>> 0).toString(36)}`;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  emailReminders: true,
  smsReminders: false,
  deadlineAlerts: true,
  caseStatusAlerts: true,
  missingDocumentReminders: true,
  supportTicketUpdates: true,
};

const TYPE_TO_PREF: Record<NotificationEventType, keyof NotificationPreferences | null> = {
  deadline_alert: "deadlineAlerts",
  case_status: "caseStatusAlerts",
  missing_document: "missingDocumentReminders",
  support_update: "supportTicketUpdates",
  review_update: "caseStatusAlerts",
  billing_update: null, // always delivered
  welcome: null,
};

/** Build mock outbox entries for a user, honoring their notification prefs. */
function notify(
  user: User | undefined,
  type: NotificationEventType,
  subject: string,
  body: string,
): NotificationEvent[] {
  if (!user) return [];
  const prefKey = TYPE_TO_PREF[type];
  if (prefKey && !user.notificationPrefs[prefKey]) return [];
  const now = new Date().toISOString();
  const events: NotificationEvent[] = [];
  if (user.notificationPrefs.emailReminders || !prefKey) {
    events.push({ id: uid(), userId: user.id, type, channel: "email", subject, body, createdAt: now, status: "mock_sent" });
  }
  if (user.notificationPrefs.smsReminders && prefKey) {
    events.push({ id: uid(), userId: user.id, type, channel: "sms", subject, body, createdAt: now, status: "mock_sent" });
  }
  return events;
}

function touch(kase: Case): Case {
  return { ...kase, updatedAt: new Date().toISOString() };
}

interface BureauState {
  users: User[];
  sessionUserId: string | null;
  cases: Case[];
  subscriptions: Subscription[];
  tickets: SupportTicket[];
  reviews: ReviewRequest[];
  files: UploadedFile[];
  acceptances: DisclaimerAcceptance[];
  notifications: NotificationEvent[];
  seeded: boolean;
  migratedV1: boolean;
  hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  ensureSeeded: () => void;

  // Auth (local abstraction — see AUTH NOTE)
  signUp: (name: string, email: string, password: string, usState: string) => { ok: boolean; error?: string };
  logIn: (email: string, password: string) => { ok: boolean; error?: string };
  logInDemo: (role: UserRole) => void;
  logOut: () => void;
  updateProfile: (partial: Partial<Pick<User, "name" | "email" | "usState" | "phone">>) => void;
  updateNotificationPrefs: (partial: Partial<NotificationPreferences>) => void;

  // Legal
  acceptDisclaimers: (caseId: string | null) => void;

  // Billing (mock — Stripe-ready shape)
  setSubscriptionTier: (tier: ServiceTierId) => void;
  cancelSubscription: () => void;

  // Cases
  createCase: (slug: NavigatorSlug, title?: string) => Case;
  deleteCase: (id: string) => void;
  setCaseStatus: (id: string, status: CaseStatus, actor?: "customer" | "staff") => void;
  setCaseServiceTier: (id: string, tier: ServiceTierId) => void;
  assignCase: (id: string, staffName: string | null) => void;
  addCaseAdminNote: (id: string, authorName: string, body: string) => void;
  saveIntakeProgress: (id: string, answers: Record<string, AnswerValue>, step: number) => void;
  completeIntake: (id: string) => void;
  regeneratePlan: (id: string) => void;
  toggleTask: (id: string, taskId: string) => void;
  addTask: (id: string, title: string) => void;
  setDocumentStatus: (id: string, docId: string, status: DocumentStatus) => void;
  toggleDeadlineVerified: (id: string, deadlineId: string) => void;
  addTimelineEvent: (id: string, type: TimelineEventType, title: string, detail?: string) => void;
  saveLetter: (id: string, letter: Omit<GeneratedLetter, "id" | "createdAt" | "updatedAt">) => void;
  updateLetter: (id: string, letterId: string, body: string) => void;
  deleteLetter: (id: string, letterId: string) => void;

  // Files (metadata only in MVP)
  addFile: (caseId: string, meta: { name: string; fileType: string; sizeLabel: string; category: FileCategory; notes: string }) => void;
  setFileStatus: (fileId: string, status: UploadedFile["status"], notes?: string) => void;
  deleteFile: (fileId: string) => void;

  // Support
  createTicket: (input: { caseId: string | null; category: TicketCategory; subject: string; body: string }) => SupportTicket;
  addTicketMessage: (ticketId: string, authorRole: "customer" | "staff", authorName: string, body: string) => void;
  setTicketStatus: (ticketId: string, status: TicketStatus) => void;
  addTicketInternalNote: (ticketId: string, authorName: string, body: string) => void;

  // Professional review
  requestReview: (caseId: string, customerNotes: string) => void;
  setReviewStatus: (reviewId: string, status: ReviewStatus) => void;
  addReviewerNote: (reviewId: string, authorName: string, body: string) => void;

  resetAllData: (reseed: boolean) => void;
}

function makeUser(
  id: string,
  name: string,
  email: string,
  password: string,
  role: UserRole,
  usState: string,
): User {
  return {
    id,
    name,
    email: email.toLowerCase(),
    passwordHash: demoHash(password),
    role,
    usState,
    phone: "",
    createdAt: new Date().toISOString(),
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
  };
}

export const useBureauStore = create<BureauState>()(
  persist(
    (set, get) => {
      /** Look up the signed-in user (undefined when logged out). */
      const me = () => get().users.find((u) => u.id === get().sessionUserId);
      const userById = (id: string) => get().users.find((u) => u.id === id);
      const pushNotifications = (events: NotificationEvent[]) => {
        if (events.length) set({ notifications: [...events, ...get().notifications] });
      };
      const mapCase = (id: string, fn: (c: Case) => Case) =>
        set({ cases: get().cases.map((c) => (c.id === id ? fn(c) : c)) });

      return {
        users: [],
        sessionUserId: null,
        cases: [],
        subscriptions: [],
        tickets: [],
        reviews: [],
        files: [],
        acceptances: [],
        notifications: [],
        seeded: false,
        migratedV1: false,
        hasHydrated: false,

        setHasHydrated: (v) => set({ hasHydrated: v }),

        ensureSeeded: () => {
          const s = get();
          if (s.seeded) return;
          const now = new Date().toISOString();

          const customer = makeUser(DEMO_CUSTOMER_ID, "Jordan Avery", DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD, "customer", "California");
          const admin = makeUser(DEMO_ADMIN_ID, "Alex Reyes", DEMO_ADMIN_EMAIL, DEMO_PASSWORD, "admin", "");

          let seedCases = buildSeedCases(customer.id, "assisted_review");

          // One-time migration of pre-account (v1) data into the demo customer.
          let migrated = s.migratedV1;
          if (!migrated && typeof localStorage !== "undefined") {
            try {
              const rawV1 = localStorage.getItem("bureauos-data-v1");
              if (rawV1) {
                const parsed = legacyPersistedStateSchema.safeParse(JSON.parse(rawV1).state ?? JSON.parse(rawV1));
                if (parsed.success) {
                  const upgraded: Case[] = parsed.data.cases.map((c) => ({
                    ...c,
                    userId: customer.id,
                    serviceTier: "self_service" as const,
                    assignedTo: null,
                    adminNotes: [],
                  }));
                  // Avoid duplicating seed titles if v1 held the original demo cases.
                  const seedTitles = new Set(seedCases.map((k) => k.title));
                  seedCases = [...upgraded.filter((c) => !seedTitles.has(c.title)), ...seedCases];
                }
              }
            } catch {
              // Unreadable legacy data — skip migration rather than crash.
            }
            migrated = true;
          }

          // Operational garnish so the admin console feels lived-in.
          const insurance = seedCases.find((c) => c.navigatorSlug === "insurance-denial");
          const tenant = seedCases.find((c) => c.navigatorSlug === "tenant-rights");
          if (insurance) {
            insurance.assignedTo = "Alex Reyes";
            insurance.adminNotes = [
              { id: uid(), authorName: "Alex Reyes", body: "Denial letter cites MN-204. Policy excerpt supports the appeal — PT-first prerequisite was met. Waiting on provider support letter before review can complete.", createdAt: daysFromNow(-2) },
            ];
          }

          const review: ReviewRequest[] = insurance
            ? [{
                id: uid(),
                caseId: insurance.id,
                userId: customer.id,
                status: "in_review",
                customerNotes: "Please check whether my appeal letter addresses the 'not medically necessary' reason strongly enough, and whether I'm missing any evidence before I send it.",
                reviewerNotes: [
                  { id: uid(), authorName: "Alex Reyes", body: "Letter structure is solid. Flagging: needs the treating physician's letter of medical necessity before submission.", createdAt: daysFromNow(-1) },
                ],
                requestedAt: daysFromNow(-3),
                updatedAt: daysFromNow(-1),
              }]
            : [];

          const ticket: SupportTicket = {
            id: uid(),
            userId: customer.id,
            caseId: tenant?.id ?? null,
            category: "case_help",
            subject: "Should I send the repair letter before or after calling code enforcement?",
            status: "waiting_on_customer",
            messages: [
              { id: uid(), authorRole: "customer", authorName: customer.name, body: "My landlord ignored two texts about the ceiling leak. The plan says to send the written request first, but a neighbor said to call code enforcement right away. Which order is right?", createdAt: daysFromNow(-2) },
              { id: uid(), authorRole: "staff", authorName: admin.name, body: "Good question — send the written request first and keep proof of delivery. Code enforcement is the escalation if the landlord stays silent past a reasonable window (your plan flags ~14 days for a major repair). Want us to look over your letter draft before you send it? If yes, reply here and attach it to the case.", createdAt: daysFromNow(-1) },
            ],
            internalNotes: [
              { id: uid(), authorName: admin.name, body: "Customer is on Assisted Review — offer a letter check-in before escalation advice goes further.", createdAt: daysFromNow(-1) },
            ],
            createdAt: daysFromNow(-2),
            updatedAt: daysFromNow(-1),
          };

          const files: UploadedFile[] = tenant
            ? [
                { id: uid(), caseId: tenant.id, userId: customer.id, name: "ceiling-leak-photo-1.jpg", fileType: "image/jpeg", sizeLabel: "2.1 MB", category: "repair_photos", uploadedAt: daysFromNow(-9), status: "verified", notes: "Water stain, bathroom ceiling — dated in frame." },
                { id: uid(), caseId: tenant.id, userId: customer.id, name: "lease-2025-signed.pdf", fileType: "application/pdf", sizeLabel: "840 KB", category: "lease_documents", uploadedAt: daysFromNow(-9), status: "verified", notes: "" },
              ]
            : [];
          if (insurance) {
            files.push({ id: uid(), caseId: insurance.id, userId: customer.id, name: "meridian-denial-letter.pdf", fileType: "application/pdf", sizeLabel: "312 KB", category: "insurance_denial_letters", uploadedAt: daysFromNow(-6), status: "pending_review", notes: "Full EOB, 3 pages." });
          }

          const subscription: Subscription = {
            id: uid(),
            userId: customer.id,
            tier: "assisted_review",
            status: "active",
            startedAt: daysFromNow(-30),
            updatedAt: daysFromNow(-30),
            history: [
              { id: uid(), label: "Assisted Review — monthly (simulated)", amountLabel: "$29.00", date: daysFromNow(-30), kind: "mock_charge" },
              { id: uid(), label: "Assisted Review — monthly (simulated)", amountLabel: "$29.00", date: daysFromNow(-1), kind: "mock_charge" },
            ],
          };

          const acceptance: DisclaimerAcceptance = {
            id: uid(),
            userId: customer.id,
            caseId: null,
            version: DISCLAIMER_VERSION,
            acceptedTerms: true,
            acceptedPrivacy: true,
            acceptedDisclaimer: true,
            acceptedAt: daysFromNow(-30),
          };

          const welcome = notify(customer, "welcome", "Welcome to BureauOS", "Your account is set up. Start a case any time — your dashboard keeps everything organized.");
          const reviewNote = notify(customer, "review_update", "Your review is in progress", "A reviewer is examining your MRI claim denial case file.");

          set({
            users: [...s.users, customer, admin],
            cases: [...s.cases, ...seedCases],
            subscriptions: [...s.subscriptions, subscription],
            tickets: [...s.tickets, ticket],
            reviews: [...s.reviews, ...review],
            files: [...s.files, ...files],
            acceptances: [...s.acceptances, acceptance],
            notifications: [...welcome, ...reviewNote, ...s.notifications],
            seeded: true,
            migratedV1: migrated,
            // Land visitors in the demo customer session so the app works instantly.
            sessionUserId: s.sessionUserId ?? customer.id,
          });
          void now;
        },

        /* ---------------------------- Auth ---------------------------- */

        signUp: (name, email, password, usState) => {
          const normalized = email.trim().toLowerCase();
          if (!name.trim() || !normalized.includes("@") || password.length < 8) {
            return { ok: false, error: "Enter your name, a valid email, and a password of at least 8 characters." };
          }
          if (get().users.some((u) => u.email === normalized)) {
            return { ok: false, error: "An account with that email already exists. Try logging in." };
          }
          const user = makeUser(uid(), name.trim(), normalized, password, "customer", usState.trim());
          const sub: Subscription = {
            id: uid(), userId: user.id, tier: "self_service", status: "active",
            startedAt: user.createdAt, updatedAt: user.createdAt,
            history: [{ id: uid(), label: "Self-Service Navigator — free plan", amountLabel: "$0.00", date: user.createdAt, kind: "plan_change" }],
          };
          set({
            users: [...get().users, user],
            subscriptions: [...get().subscriptions, sub],
            sessionUserId: user.id,
          });
          pushNotifications(notify(user, "welcome", "Welcome to BureauOS", "Your account is set up. Start a case any time."));
          return { ok: true };
        },

        logIn: (email, password) => {
          const user = get().users.find((u) => u.email === email.trim().toLowerCase());
          if (!user || user.passwordHash !== demoHash(password)) {
            return { ok: false, error: "Invalid email or password." };
          }
          set({ sessionUserId: user.id });
          return { ok: true };
        },

        logInDemo: (role) => {
          get().ensureSeeded();
          set({ sessionUserId: role === "admin" ? DEMO_ADMIN_ID : DEMO_CUSTOMER_ID });
        },

        logOut: () => set({ sessionUserId: null }),

        updateProfile: (partial) => {
          const user = me();
          if (!user) return;
          set({
            users: get().users.map((u) =>
              u.id === user.id
                ? { ...u, ...partial, email: partial.email ? partial.email.toLowerCase() : u.email }
                : u,
            ),
          });
        },

        updateNotificationPrefs: (partial) => {
          const user = me();
          if (!user) return;
          set({
            users: get().users.map((u) =>
              u.id === user.id ? { ...u, notificationPrefs: { ...u.notificationPrefs, ...partial } } : u,
            ),
          });
        },

        /* ---------------------------- Legal --------------------------- */

        acceptDisclaimers: (caseId) => {
          const user = me();
          if (!user) return;
          set({
            acceptances: [
              ...get().acceptances,
              {
                id: uid(), userId: user.id, caseId, version: DISCLAIMER_VERSION,
                acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true,
                acceptedAt: new Date().toISOString(),
              },
            ],
          });
        },

        /* --------------------------- Billing -------------------------- */

        setSubscriptionTier: (tier) => {
          const user = me();
          if (!user) return;
          const now = new Date().toISOString();
          const tierDef = getTier(tier);
          const existing = get().subscriptions.find((s) => s.userId === user.id);
          const entry = {
            id: uid(),
            label: `${tierDef.name} — ${tierDef.priceMonthly > 0 ? "monthly (simulated)" : "free plan"}`,
            amountLabel: `$${tierDef.priceMonthly.toFixed(2)}`,
            date: now,
            kind: tierDef.priceMonthly > 0 ? ("mock_charge" as const) : ("plan_change" as const),
          };
          if (existing) {
            set({
              subscriptions: get().subscriptions.map((s) =>
                s.userId === user.id
                  ? { ...s, tier, status: "active", updatedAt: now, history: [...s.history, entry] }
                  : s,
              ),
            });
          } else {
            set({
              subscriptions: [
                ...get().subscriptions,
                { id: uid(), userId: user.id, tier, status: "active", startedAt: now, updatedAt: now, history: [entry] },
              ],
            });
          }
          pushNotifications(notify(user, "billing_update", `Plan updated: ${tierDef.name}`, "Your BureauOS service package was updated (simulated checkout — no real charge)."));
        },

        cancelSubscription: () => {
          const user = me();
          if (!user) return;
          const now = new Date().toISOString();
          set({
            subscriptions: get().subscriptions.map((s) =>
              s.userId === user.id
                ? {
                    ...s, tier: "self_service", status: "canceled", updatedAt: now,
                    history: [...s.history, { id: uid(), label: "Paid plan canceled — reverted to Self-Service", amountLabel: "$0.00", date: now, kind: "plan_change" as const }],
                  }
                : s,
            ),
          });
        },

        /* ---------------------------- Cases --------------------------- */

        createCase: (slug, title) => {
          const user = me();
          const nav = getNavigator(slug);
          const now = new Date().toISOString();
          const sub = get().subscriptions.find((s) => s.userId === user?.id);
          const kase: Case = {
            id: uid(),
            userId: user?.id ?? DEMO_CUSTOMER_ID,
            navigatorSlug: slug,
            title: title?.trim() || `${nav?.shortName ?? "New"} case`,
            status: "intake",
            priority: "medium",
            serviceTier: sub?.status === "active" ? sub.tier : "self_service",
            assignedTo: null,
            createdAt: now,
            updatedAt: now,
            intake: { answers: {}, currentStep: 0, completed: false },
            plan: null,
            tasks: [],
            documents: [],
            deadlines: [],
            letters: [],
            timeline: [
              { id: uid(), type: "case_created", title: "Case created", detail: `Started in the ${nav?.name ?? "navigator"}.`, date: now },
            ],
            adminNotes: [],
          };
          set({ cases: [kase, ...get().cases] });
          return kase;
        },

        deleteCase: (id) =>
          set({
            cases: get().cases.filter((c) => c.id !== id),
            files: get().files.filter((f) => f.caseId !== id),
            reviews: get().reviews.filter((r) => r.caseId !== id),
          }),

        setCaseStatus: (id, status, actor = "customer") => {
          const kase = get().cases.find((c) => c.id === id);
          mapCase(id, (c) =>
            touch({
              ...c,
              status,
              timeline: [
                ...c.timeline,
                { id: uid(), type: "status_change" as const, title: `Status changed to ${status.replace(/_/g, " ")}`, detail: actor === "staff" ? "Updated by BureauOS staff." : undefined, date: new Date().toISOString() },
              ],
            }),
          );
          if (kase && actor === "staff") {
            pushNotifications(notify(userById(kase.userId), "case_status", `Case update: ${kase.title}`, `Status changed to ${status.replace(/_/g, " ")} by the BureauOS team.`));
          }
        },

        setCaseServiceTier: (id, tier) =>
          mapCase(id, (c) => touch({ ...c, serviceTier: tier })),

        assignCase: (id, staffName) =>
          mapCase(id, (c) => touch({ ...c, assignedTo: staffName })),

        addCaseAdminNote: (id, authorName, body) =>
          mapCase(id, (c) =>
            touch({ ...c, adminNotes: [...c.adminNotes, { id: uid(), authorName, body, createdAt: new Date().toISOString() }] }),
          ),

        saveIntakeProgress: (id, answers, step) =>
          mapCase(id, (c) => touch({ ...c, intake: { ...c.intake, answers, currentStep: step } })),

        completeIntake: (id) =>
          set({
            cases: get().cases.map((c) => {
              if (c.id !== id) return c;
              const completed: Case = touch({
                ...c,
                status: "planning",
                intake: { ...c.intake, completed: true },
                timeline: [
                  ...c.timeline,
                  { id: uid(), type: "intake_completed" as const, title: "Intake completed", detail: "All intake questions answered.", date: new Date().toISOString() },
                ],
              });
              return generatePlanForCase(completed);
            }),
          }),

        regeneratePlan: (id) =>
          set({ cases: get().cases.map((c) => (c.id === id ? generatePlanForCase(c) : c)) }),

        toggleTask: (id, taskId) =>
          mapCase(id, (c) => {
            const task = c.tasks.find((t) => t.id === taskId);
            if (!task) return c;
            const nowDone = !task.done;
            return touch({
              ...c,
              tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, done: nowDone } : t)),
              timeline: nowDone
                ? [...c.timeline, { id: uid(), type: "task_completed" as const, title: `Task completed: ${task.title}`, date: new Date().toISOString() }]
                : c.timeline,
            });
          }),

        addTask: (id, title) =>
          mapCase(id, (c) =>
            touch({
              ...c,
              tasks: [...c.tasks, { id: uid(), title, done: false, category: "Custom", createdAt: new Date().toISOString() }],
            }),
          ),

        setDocumentStatus: (id, docId, status) =>
          mapCase(id, (c) => {
            const doc = c.documents.find((d) => d.id === docId);
            if (!doc) return c;
            return touch({
              ...c,
              documents: c.documents.map((d) => (d.id === docId ? { ...d, status } : d)),
              timeline:
                status === "obtained"
                  ? [...c.timeline, { id: uid(), type: "document_update" as const, title: `Document obtained: ${doc.name}`, date: new Date().toISOString() }]
                  : c.timeline,
            });
          }),

        toggleDeadlineVerified: (id, deadlineId) =>
          mapCase(id, (c) =>
            touch({
              ...c,
              deadlines: c.deadlines.map((d) => (d.id === deadlineId ? { ...d, verified: !d.verified } : d)),
            }),
          ),

        addTimelineEvent: (id, type, title, detail) =>
          mapCase(id, (c) =>
            touch({
              ...c,
              timeline: [...c.timeline, { id: uid(), type, title, detail, date: new Date().toISOString() }],
            }),
          ),

        saveLetter: (id, letter) =>
          mapCase(id, (c) => {
            const now = new Date().toISOString();
            return touch({
              ...c,
              letters: [{ ...letter, id: uid(), createdAt: now, updatedAt: now }, ...c.letters],
              timeline: [...c.timeline, { id: uid(), type: "letter_generated" as const, title: `Letter saved: ${letter.title}`, date: now }],
            });
          }),

        updateLetter: (id, letterId, body) =>
          mapCase(id, (c) =>
            touch({
              ...c,
              letters: c.letters.map((l) => (l.id === letterId ? { ...l, body, updatedAt: new Date().toISOString() } : l)),
            }),
          ),

        deleteLetter: (id, letterId) =>
          mapCase(id, (c) => touch({ ...c, letters: c.letters.filter((l) => l.id !== letterId) })),

        /* ---------------------------- Files --------------------------- */

        addFile: (caseId, meta) => {
          const user = me();
          const kase = get().cases.find((c) => c.id === caseId);
          if (!user || !kase) return;
          set({
            files: [
              { id: uid(), caseId, userId: kase.userId, uploadedAt: new Date().toISOString(), status: "pending_review", ...meta },
              ...get().files,
            ],
          });
          get().addTimelineEvent(caseId, "document_update", `File attached: ${meta.name}`, "Awaiting review by the BureauOS team.");
        },

        setFileStatus: (fileId, status, notes) => {
          const file = get().files.find((f) => f.id === fileId);
          set({
            files: get().files.map((f) =>
              f.id === fileId ? { ...f, status, notes: notes !== undefined ? notes : f.notes } : f,
            ),
          });
          if (file && status === "rejected") {
            pushNotifications(notify(userById(file.userId), "missing_document", `Action needed: ${file.name}`, "A file on your case needs to be re-uploaded or replaced. Check the document checklist."));
          }
        },

        deleteFile: (fileId) => set({ files: get().files.filter((f) => f.id !== fileId) }),

        /* --------------------------- Support -------------------------- */

        createTicket: ({ caseId, category, subject, body }) => {
          const user = me();
          const now = new Date().toISOString();
          const ticket: SupportTicket = {
            id: uid(),
            userId: user?.id ?? DEMO_CUSTOMER_ID,
            caseId,
            category,
            subject,
            status: "open",
            messages: [{ id: uid(), authorRole: "customer", authorName: user?.name ?? "Customer", body, createdAt: now }],
            internalNotes: [],
            createdAt: now,
            updatedAt: now,
          };
          set({ tickets: [ticket, ...get().tickets] });
          pushNotifications(notify(user, "support_update", `Ticket received: ${subject}`, "We've logged your support request. You'll hear back based on your service package."));
          return ticket;
        },

        addTicketMessage: (ticketId, authorRole, authorName, body) => {
          const ticket = get().tickets.find((t) => t.id === ticketId);
          const now = new Date().toISOString();
          set({
            tickets: get().tickets.map((t) =>
              t.id === ticketId
                ? {
                    ...t,
                    updatedAt: now,
                    status: authorRole === "staff" && t.status === "open" ? "waiting_on_customer" : t.status,
                    messages: [...t.messages, { id: uid(), authorRole, authorName, body, createdAt: now }],
                  }
                : t,
            ),
          });
          if (ticket && authorRole === "staff") {
            pushNotifications(notify(userById(ticket.userId), "support_update", `Reply on: ${ticket.subject}`, "BureauOS support replied to your ticket."));
          }
        },

        setTicketStatus: (ticketId, status) => {
          const ticket = get().tickets.find((t) => t.id === ticketId);
          set({
            tickets: get().tickets.map((t) =>
              t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t,
            ),
          });
          if (ticket) {
            pushNotifications(notify(userById(ticket.userId), "support_update", `Ticket ${status.replace(/_/g, " ")}: ${ticket.subject}`, "Your support ticket status was updated."));
          }
        },

        addTicketInternalNote: (ticketId, authorName, body) =>
          set({
            tickets: get().tickets.map((t) =>
              t.id === ticketId
                ? { ...t, internalNotes: [...t.internalNotes, { id: uid(), authorName, body, createdAt: new Date().toISOString() }] }
                : t,
            ),
          }),

        /* ---------------------- Professional review ------------------- */

        requestReview: (caseId, customerNotes) => {
          const user = me();
          const kase = get().cases.find((c) => c.id === caseId);
          if (!kase) return;
          const now = new Date().toISOString();
          const existing = get().reviews.find((r) => r.caseId === caseId);
          if (existing) {
            set({
              reviews: get().reviews.map((r) =>
                r.caseId === caseId ? { ...r, status: "requested", customerNotes, updatedAt: now } : r,
              ),
            });
          } else {
            set({
              reviews: [
                { id: uid(), caseId, userId: kase.userId, status: "requested", customerNotes, reviewerNotes: [], requestedAt: now, updatedAt: now },
                ...get().reviews,
              ],
            });
          }
          get().addTimelineEvent(caseId, "note", "Professional review requested", "Your case file was submitted for review.");
          pushNotifications(notify(user, "review_update", `Review requested: ${kase.title}`, "Your case file is in the review queue. You'll be notified as the status changes."));
        },

        setReviewStatus: (reviewId, status) => {
          const review = get().reviews.find((r) => r.id === reviewId);
          set({
            reviews: get().reviews.map((r) =>
              r.id === reviewId ? { ...r, status, updatedAt: new Date().toISOString() } : r,
            ),
          });
          if (review) {
            const kase = get().cases.find((c) => c.id === review.caseId);
            pushNotifications(notify(userById(review.userId), "review_update", `Review ${status.replace(/_/g, " ")}: ${kase?.title ?? "your case"}`, "Your professional review status was updated."));
          }
        },

        addReviewerNote: (reviewId, authorName, body) =>
          set({
            reviews: get().reviews.map((r) =>
              r.id === reviewId
                ? { ...r, updatedAt: new Date().toISOString(), reviewerNotes: [...r.reviewerNotes, { id: uid(), authorName, body, createdAt: new Date().toISOString() }] }
                : r,
            ),
          }),

        /* ----------------------------- Data --------------------------- */

        resetAllData: (reseed) => {
          set({
            users: [], sessionUserId: null, cases: [], subscriptions: [], tickets: [],
            reviews: [], files: [], acceptances: [], notifications: [],
            seeded: false, migratedV1: true,
          });
          if (reseed) {
            get().ensureSeeded();
          }
        },
      };
    },
    {
      name: "bureauos-data-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        users: s.users,
        sessionUserId: s.sessionUserId,
        cases: s.cases,
        subscriptions: s.subscriptions,
        tickets: s.tickets,
        reviews: s.reviews,
        files: s.files,
        acceptances: s.acceptances,
        notifications: s.notifications,
        seeded: s.seeded,
        migratedV1: s.migratedV1,
      }),
      merge: (persisted, current) => {
        const parsed = persistedStateSchema.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        // Corrupted or outdated storage — start fresh rather than crash.
        return current;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/* ------------------------------ Selectors ------------------------------ */

/** True once localStorage state has been loaded on the client. */
export function useHydrated(): boolean {
  return useBureauStore((s) => s.hasHydrated);
}

export function useCurrentUser(): User | undefined {
  return useBureauStore((s) => s.users.find((u) => u.id === s.sessionUserId));
}

export function useIsAdmin(): boolean {
  return useBureauStore((s) => s.users.find((u) => u.id === s.sessionUserId)?.role === "admin");
}

/** A single case, only if the current user may access it (owner or admin). */
export function useCase(id: string): Case | undefined {
  return useBureauStore((s) => {
    const kase = s.cases.find((c) => c.id === id);
    if (!kase) return undefined;
    const user = s.users.find((u) => u.id === s.sessionUserId);
    if (!user) return undefined;
    return user.role === "admin" || kase.userId === user.id ? kase : undefined;
  });
}

/** Cases owned by the signed-in customer. */
export function useMyCases(): Case[] {
  const cases = useBureauStore((s) => s.cases);
  const sessionUserId = useBureauStore((s) => s.sessionUserId);
  return useMemo(() => cases.filter((c) => c.userId === sessionUserId), [cases, sessionUserId]);
}

export function useMySubscription(): Subscription | undefined {
  return useBureauStore((s) => s.subscriptions.find((sub) => sub.userId === s.sessionUserId));
}

/** Whether the current user has accepted the current disclaimer version. */
export function useHasAccepted(): boolean {
  return useBureauStore((s) =>
    s.acceptances.some((a) => a.userId === s.sessionUserId && a.version === DISCLAIMER_VERSION),
  );
}
