"use client";

import { useMemo } from "react";
import { create } from "zustand";
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
import { uid } from "@/lib/utils";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_CUSTOMER_EMAIL,
  DEMO_PASSWORD,
  DISCLAIMER_VERSION,
} from "@/lib/constants";

// Re-exported for existing imports (login page, disclaimer gate, etc.).
export { DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD, DISCLAIMER_VERSION };

/**
 * BureauOS client data layer (v3 — server-backed).
 *
 * The database (Prisma/SQLite behind /api/*) is the source of truth. This
 * store is an in-memory, session-scoped cache:
 *   - `bootstrap()` loads the signed-in user's data from GET /api/bootstrap
 *   - reads go through the same selectors components always used
 *   - writes update the cache optimistically AND call the validated API
 *     route; the server response (authoritative, authorization-checked)
 *     replaces the optimistic entity when it lands
 *
 * Nothing case/ticket/review/billing/acceptance-related is persisted in
 * localStorage anymore — the session lives in an httpOnly cookie and data
 * reloads from the API. Authorization is enforced server-side; the client
 * checks that remain are UX, not security.
 */

/* ------------------------------ API helpers ---------------------------- */

async function apiFetch<T>(url: string, method: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.warn(`[bureauos] ${method} ${url} → ${res.status}`, detail);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[bureauos] ${method} ${url} failed`, err);
    return null;
  }
}

/** Per-entity write sequence guard so a slow response can't clobber a newer one. */
const writeSeq = new Map<string, number>();
function nextSeq(key: string): number {
  const n = (writeSeq.get(key) ?? 0) + 1;
  writeSeq.set(key, n);
  return n;
}
function isLatest(key: string, seq: number): boolean {
  return writeSeq.get(key) === seq;
}

interface CaseActionResponse {
  case: Case;
  notifications: NotificationEvent[];
}

interface BootstrapResponse {
  sessionUserId: string;
  users: User[];
  cases: Case[];
  tickets: SupportTicket[];
  reviews: ReviewRequest[];
  files: UploadedFile[];
  subscriptions: Subscription[];
  acceptances: DisclaimerAcceptance[];
  notifications: NotificationEvent[];
}

/* --------------------------------- store ------------------------------- */

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
  /** True once the initial bootstrap fetch has settled (signed in or not). */
  hasHydrated: boolean;

  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;

  // Auth (demo-grade sessions; enforced server-side)
  signUp: (name: string, email: string, password: string, usState: string) => Promise<{ ok: boolean; error?: string }>;
  logIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logInDemo: (role: UserRole) => Promise<void>;
  logOut: () => Promise<void>;
  updateProfile: (partial: Partial<Pick<User, "name" | "email" | "usState" | "phone">>) => void;
  updateNotificationPrefs: (partial: Partial<NotificationPreferences>) => void;

  // Legal
  acceptDisclaimers: (caseId: string | null) => Promise<void>;

  // Billing (simulated — Stripe later)
  setSubscriptionTier: (tier: ServiceTierId) => Promise<void>;
  cancelSubscription: () => void;

  // Cases
  createCase: (slug: NavigatorSlug, title?: string) => Promise<Case | null>;
  deleteCase: (id: string) => void;
  setCaseStatus: (id: string, status: CaseStatus, actor?: "customer" | "staff") => void;
  setCaseServiceTier: (id: string, tier: ServiceTierId) => void;
  assignCase: (id: string, staffName: string | null) => void;
  addCaseAdminNote: (id: string, authorName: string, body: string) => void;
  saveIntakeProgress: (id: string, answers: Record<string, AnswerValue>, step: number) => Promise<void>;
  completeIntake: (id: string) => Promise<void>;
  regeneratePlan: (id: string) => void;
  toggleTask: (id: string, taskId: string) => void;
  addTask: (id: string, title: string) => void;
  setDocumentStatus: (id: string, docId: string, status: DocumentStatus) => void;
  toggleDeadlineVerified: (id: string, deadlineId: string) => void;
  addTimelineEvent: (id: string, type: TimelineEventType, title: string, detail?: string) => void;
  saveLetter: (id: string, letter: Omit<GeneratedLetter, "id" | "createdAt" | "updatedAt">) => void;
  updateLetter: (id: string, letterId: string, body: string) => void;
  deleteLetter: (id: string, letterId: string) => void;

  // Files (metadata only in Phase 1)
  addFile: (caseId: string, meta: { name: string; fileType: string; sizeLabel: string; category: FileCategory; notes: string }) => void;
  setFileStatus: (fileId: string, status: UploadedFile["status"], notes?: string) => void;
  deleteFile: (fileId: string) => void;

  // Support
  createTicket: (input: { caseId: string | null; category: TicketCategory; subject: string; body: string }) => Promise<SupportTicket | null>;
  addTicketMessage: (ticketId: string, authorRole: "customer" | "staff", authorName: string, body: string) => void;
  setTicketStatus: (ticketId: string, status: TicketStatus) => void;
  addTicketInternalNote: (ticketId: string, authorName: string, body: string) => void;

  // Professional review
  requestReview: (caseId: string, customerNotes: string) => Promise<void>;
  setReviewStatus: (reviewId: string, status: ReviewStatus) => void;
  addReviewerNote: (reviewId: string, authorName: string, body: string) => void;

  resetAllData: (reseed: boolean) => Promise<void>;
}

const EMPTY_DATA = {
  users: [] as User[],
  sessionUserId: null as string | null,
  cases: [] as Case[],
  subscriptions: [] as Subscription[],
  tickets: [] as SupportTicket[],
  reviews: [] as ReviewRequest[],
  files: [] as UploadedFile[],
  acceptances: [] as DisclaimerAcceptance[],
  notifications: [] as NotificationEvent[],
};

let bootstrapInFlight: Promise<void> | null = null;

export const useBureauStore = create<BureauState>()((set, get) => {
  const me = () => get().users.find((u) => u.id === get().sessionUserId);

  const mergeNotifications = (incoming: NotificationEvent[] | undefined) => {
    if (!incoming?.length) return;
    const known = new Set(get().notifications.map((n) => n.id));
    const fresh = incoming.filter((n) => !known.has(n.id));
    if (fresh.length) set({ notifications: [...fresh, ...get().notifications] });
  };

  const replaceCase = (kase: Case) =>
    set({ cases: get().cases.map((c) => (c.id === kase.id ? kase : c)) });

  const replaceTicket = (ticket: SupportTicket) =>
    set({ tickets: get().tickets.map((t) => (t.id === ticket.id ? ticket : t)) });

  const replaceReview = (review: ReviewRequest) =>
    set({
      reviews: get().reviews.some((r) => r.id === review.id)
        ? get().reviews.map((r) => (r.id === review.id ? review : r))
        : [review, ...get().reviews],
    });

  const mapCase = (id: string, fn: (c: Case) => Case) =>
    set({ cases: get().cases.map((c) => (c.id === id ? fn(c) : c)) });

  const touch = (kase: Case): Case => ({ ...kase, updatedAt: new Date().toISOString() });

  /** Optimistic local update already applied — write through and reconcile. */
  const caseAction = async (id: string, action: Record<string, unknown>) => {
    const seq = nextSeq(`case:${id}`);
    const data = await apiFetch<CaseActionResponse>(`/api/cases/${id}/actions`, "POST", action);
    if (!data || !isLatest(`case:${id}`, seq)) return;
    replaceCase(data.case);
    mergeNotifications(data.notifications);
  };

  const ticketAction = async (id: string, action: Record<string, unknown>) => {
    const seq = nextSeq(`ticket:${id}`);
    const data = await apiFetch<{ ticket: SupportTicket; notifications: NotificationEvent[] }>(
      `/api/tickets/${id}/actions`,
      "POST",
      action,
    );
    if (!data || !isLatest(`ticket:${id}`, seq)) return;
    replaceTicket(data.ticket);
    mergeNotifications(data.notifications);
  };

  const reviewAction = async (id: string, action: Record<string, unknown>) => {
    const seq = nextSeq(`review:${id}`);
    const data = await apiFetch<{ review: ReviewRequest; notifications: NotificationEvent[] }>(
      `/api/reviews/${id}/actions`,
      "POST",
      action,
    );
    if (!data || !isLatest(`review:${id}`, seq)) return;
    replaceReview(data.review);
    mergeNotifications(data.notifications);
  };

  const loadBootstrap = async () => {
    const data = await apiFetch<BootstrapResponse>("/api/bootstrap", "GET");
    if (data) {
      set({ ...data, hasHydrated: true });
    } else {
      set({ ...EMPTY_DATA, hasHydrated: true });
    }
  };

  return {
    ...EMPTY_DATA,
    hasHydrated: false,

    bootstrap: async () => {
      if (get().hasHydrated) return;
      bootstrapInFlight ??= loadBootstrap().finally(() => {
        bootstrapInFlight = null;
      });
      await bootstrapInFlight;
    },

    refresh: async () => {
      await loadBootstrap();
    },

    /* ---------------------------- Auth ---------------------------- */

    signUp: async (name, email, password, usState) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, usState }),
      }).catch(() => null);
      if (!res) return { ok: false, error: "Network error — is the server running?" };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Sign up failed. Check your details and try again." };
      }
      await loadBootstrap();
      return { ok: true };
    },

    logIn: async (email, password) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => null);
      if (!res) return { ok: false, error: "Network error — is the server running?" };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error ?? "Invalid email or password." };
      await loadBootstrap();
      return { ok: true };
    },

    logInDemo: async (role) => {
      await apiFetch("/api/auth/demo", "POST", { role });
      await loadBootstrap();
    },

    logOut: async () => {
      await apiFetch("/api/auth/logout", "POST", {});
      set({ ...EMPTY_DATA, hasHydrated: true });
    },

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
      void (async () => {
        const seq = nextSeq("me");
        const data = await apiFetch<{ user: User }>("/api/me", "PATCH", partial);
        if (!data || !isLatest("me", seq)) return;
        set({ users: get().users.map((u) => (u.id === data.user.id ? data.user : u)) });
      })();
    },

    updateNotificationPrefs: (partial) => {
      const user = me();
      if (!user) return;
      set({
        users: get().users.map((u) =>
          u.id === user.id ? { ...u, notificationPrefs: { ...u.notificationPrefs, ...partial } } : u,
        ),
      });
      void (async () => {
        const seq = nextSeq("me-prefs");
        const data = await apiFetch<{ user: User }>("/api/me/notification-prefs", "PATCH", partial);
        if (!data || !isLatest("me-prefs", seq)) return;
        set({ users: get().users.map((u) => (u.id === data.user.id ? data.user : u)) });
      })();
    },

    /* ---------------------------- Legal --------------------------- */

    acceptDisclaimers: async (caseId) => {
      const user = me();
      if (!user) return;
      const id = uid();
      // Server-confirmed BEFORE the local gate opens, so follow-up actions
      // (complete_intake, save_letter) pass their server-side acceptance check.
      const data = await apiFetch<{ acceptance: DisclaimerAcceptance }>("/api/acceptances", "POST", { id, caseId });
      if (data) {
        set({ acceptances: [...get().acceptances, data.acceptance] });
      }
    },

    /* --------------------------- Billing -------------------------- */

    setSubscriptionTier: async (tier) => {
      const data = await apiFetch<{ subscription: Subscription; notifications: NotificationEvent[] }>(
        "/api/billing",
        "POST",
        { tier },
      );
      if (!data) return;
      set({
        subscriptions: [
          data.subscription,
          ...get().subscriptions.filter((s) => s.id !== data.subscription.id && s.userId !== data.subscription.userId),
        ],
      });
      mergeNotifications(data.notifications);
    },

    cancelSubscription: () => {
      const user = me();
      if (!user) return;
      set({
        subscriptions: get().subscriptions.map((s) =>
          s.userId === user.id ? { ...s, tier: "self_service", status: "canceled" } : s,
        ),
      });
      void (async () => {
        const data = await apiFetch<{ subscription: Subscription }>("/api/billing", "DELETE");
        if (data) {
          set({
            subscriptions: get().subscriptions.map((s) =>
              s.id === data.subscription.id || s.userId === data.subscription.userId ? data.subscription : s,
            ),
          });
        }
      })();
    },

    /* ---------------------------- Cases --------------------------- */

    createCase: async (slug, title) => {
      const data = await apiFetch<{ case: Case }>("/api/cases", "POST", {
        navigatorSlug: slug,
        title: title?.trim() || undefined,
      });
      if (!data) return null;
      set({ cases: [data.case, ...get().cases] });
      return data.case;
    },

    deleteCase: (id) => {
      set({
        cases: get().cases.filter((c) => c.id !== id),
        files: get().files.filter((f) => f.caseId !== id),
        reviews: get().reviews.filter((r) => r.caseId !== id),
      });
      void apiFetch(`/api/cases/${id}`, "DELETE");
    },

    setCaseStatus: (id, status) => {
      // Optimistic; the server derives the actor from the session role and
      // writes the timeline entry + customer notification itself.
      mapCase(id, (c) => touch({ ...c, status }));
      void caseAction(id, { type: "set_status", status });
    },

    setCaseServiceTier: (id, tier) => {
      mapCase(id, (c) => touch({ ...c, serviceTier: tier }));
      void caseAction(id, { type: "set_tier", tier });
    },

    assignCase: (id, staffName) => {
      mapCase(id, (c) => touch({ ...c, assignedTo: staffName }));
      void caseAction(id, { type: "assign", staffName });
    },

    addCaseAdminNote: (id, authorName, body) => {
      const noteId = uid();
      mapCase(id, (c) =>
        touch({ ...c, adminNotes: [...c.adminNotes, { id: noteId, authorName, body, createdAt: new Date().toISOString() }] }),
      );
      void caseAction(id, { type: "add_admin_note", id: noteId, body });
    },

    saveIntakeProgress: (id, answers, step) => {
      mapCase(id, (c) => touch({ ...c, intake: { ...c.intake, answers, currentStep: step } }));
      // Returned so completion flows can await the save before generating the plan.
      return caseAction(id, { type: "save_intake", answers, step });
    },

    completeIntake: async (id) => {
      // Server-authoritative: the rule engine runs on the server against the
      // saved answers; the response carries the plan, tasks, documents, and
      // deadlines. Await before navigating to the plan page.
      await caseAction(id, { type: "complete_intake" });
    },

    regeneratePlan: (id) => {
      void caseAction(id, { type: "regenerate_plan" });
    },

    toggleTask: (id, taskId) => {
      mapCase(id, (c) => {
        const task = c.tasks.find((t) => t.id === taskId);
        if (!task) return c;
        return touch({
          ...c,
          tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
        });
      });
      void caseAction(id, { type: "toggle_task", taskId });
    },

    addTask: (id, title) => {
      const taskId = uid();
      mapCase(id, (c) =>
        touch({
          ...c,
          tasks: [...c.tasks, { id: taskId, title, done: false, category: "Custom", createdAt: new Date().toISOString() }],
        }),
      );
      void caseAction(id, { type: "add_task", id: taskId, title });
    },

    setDocumentStatus: (id, docId, status) => {
      mapCase(id, (c) => ({
        ...touch(c),
        documents: c.documents.map((d) => (d.id === docId ? { ...d, status } : d)),
      }));
      void caseAction(id, { type: "set_document_status", docId, status });
    },

    toggleDeadlineVerified: (id, deadlineId) => {
      mapCase(id, (c) =>
        touch({
          ...c,
          deadlines: c.deadlines.map((d) => (d.id === deadlineId ? { ...d, verified: !d.verified } : d)),
        }),
      );
      void caseAction(id, { type: "toggle_deadline", deadlineId });
    },

    addTimelineEvent: (id, type, title, detail) => {
      const eventId = uid();
      mapCase(id, (c) =>
        touch({
          ...c,
          timeline: [...c.timeline, { id: eventId, type, title, detail, date: new Date().toISOString() }],
        }),
      );
      void caseAction(id, { type: "add_timeline_event", id: eventId, eventType: type, title, detail });
    },

    saveLetter: (id, letter) => {
      const letterId = uid();
      const now = new Date().toISOString();
      mapCase(id, (c) =>
        touch({ ...c, letters: [{ ...letter, id: letterId, createdAt: now, updatedAt: now }, ...c.letters] }),
      );
      void caseAction(id, {
        type: "save_letter",
        id: letterId,
        templateId: letter.templateId,
        title: letter.title,
        letterBody: letter.body,
      });
    },

    updateLetter: (id, letterId, body) => {
      mapCase(id, (c) =>
        touch({
          ...c,
          letters: c.letters.map((l) => (l.id === letterId ? { ...l, body, updatedAt: new Date().toISOString() } : l)),
        }),
      );
      void caseAction(id, { type: "update_letter", letterId, letterBody: body });
    },

    deleteLetter: (id, letterId) => {
      mapCase(id, (c) => touch({ ...c, letters: c.letters.filter((l) => l.id !== letterId) }));
      void caseAction(id, { type: "delete_letter", letterId });
    },

    /* ---------------------------- Files --------------------------- */

    addFile: (caseId, meta) => {
      const user = me();
      const kase = get().cases.find((c) => c.id === caseId);
      if (!user || !kase) return;
      const fileId = uid();
      set({
        files: [
          { id: fileId, caseId, userId: kase.userId, uploadedAt: new Date().toISOString(), status: "pending_review", ...meta },
          ...get().files,
        ],
      });
      void (async () => {
        const data = await apiFetch<{ file: UploadedFile; case: Case; notifications: NotificationEvent[] }>(
          "/api/files",
          "POST",
          { id: fileId, caseId, ...meta },
        );
        if (!data) return;
        set({ files: get().files.map((f) => (f.id === data.file.id ? data.file : f)) });
        replaceCase(data.case);
        mergeNotifications(data.notifications);
      })();
    },

    setFileStatus: (fileId, status, notes) => {
      set({
        files: get().files.map((f) =>
          f.id === fileId ? { ...f, status, notes: notes !== undefined ? notes : f.notes } : f,
        ),
      });
      void (async () => {
        const seq = nextSeq(`file:${fileId}`);
        const data = await apiFetch<{ file: UploadedFile; notifications: NotificationEvent[] }>(
          `/api/files/${fileId}`,
          "PATCH",
          { status, ...(notes !== undefined && { notes }) },
        );
        if (!data || !isLatest(`file:${fileId}`, seq)) return;
        set({ files: get().files.map((f) => (f.id === data.file.id ? data.file : f)) });
        mergeNotifications(data.notifications);
      })();
    },

    deleteFile: (fileId) => {
      set({ files: get().files.filter((f) => f.id !== fileId) });
      void apiFetch(`/api/files/${fileId}`, "DELETE");
    },

    /* --------------------------- Support -------------------------- */

    createTicket: async ({ caseId, category, subject, body }) => {
      const data = await apiFetch<{ ticket: SupportTicket; notifications: NotificationEvent[] }>(
        "/api/tickets",
        "POST",
        { caseId, category, subject, body },
      );
      if (!data) return null;
      set({ tickets: [data.ticket, ...get().tickets] });
      mergeNotifications(data.notifications);
      return data.ticket;
    },

    addTicketMessage: (ticketId, authorRole, authorName, body) => {
      const messageId = uid();
      const now = new Date().toISOString();
      set({
        tickets: get().tickets.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                updatedAt: now,
                status: authorRole === "staff" && t.status === "open" ? "waiting_on_customer" : t.status,
                messages: [...t.messages, { id: messageId, authorRole, authorName, body, createdAt: now }],
              }
            : t,
        ),
      });
      // The server derives the author role from the session — the client
      // arguments are only used for the optimistic render.
      void ticketAction(ticketId, { type: "add_message", id: messageId, body });
    },

    setTicketStatus: (ticketId, status) => {
      set({
        tickets: get().tickets.map((t) =>
          t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t,
        ),
      });
      void ticketAction(ticketId, { type: "set_status", status });
    },

    addTicketInternalNote: (ticketId, authorName, body) => {
      const noteId = uid();
      set({
        tickets: get().tickets.map((t) =>
          t.id === ticketId
            ? { ...t, internalNotes: [...t.internalNotes, { id: noteId, authorName, body, createdAt: new Date().toISOString() }] }
            : t,
        ),
      });
      void ticketAction(ticketId, { type: "add_internal_note", id: noteId, body });
    },

    /* ---------------------- Professional review ------------------- */

    requestReview: async (caseId, customerNotes) => {
      const data = await apiFetch<{ review: ReviewRequest; case: Case; notifications: NotificationEvent[] }>(
        "/api/reviews",
        "POST",
        { caseId, customerNotes },
      );
      if (!data) return;
      replaceReview(data.review);
      replaceCase(data.case);
      mergeNotifications(data.notifications);
    },

    setReviewStatus: (reviewId, status) => {
      set({
        reviews: get().reviews.map((r) =>
          r.id === reviewId ? { ...r, status, updatedAt: new Date().toISOString() } : r,
        ),
      });
      void reviewAction(reviewId, { type: "set_status", status });
    },

    addReviewerNote: (reviewId, authorName, body) => {
      const noteId = uid();
      set({
        reviews: get().reviews.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                updatedAt: new Date().toISOString(),
                reviewerNotes: [...r.reviewerNotes, { id: noteId, authorName, body, createdAt: new Date().toISOString() }],
              }
            : r,
        ),
      });
      void reviewAction(reviewId, { type: "add_note", id: noteId, body });
    },

    /* ----------------------------- Data --------------------------- */

    resetAllData: async (reseed) => {
      const data = await apiFetch<{ ok: boolean; reseeded: boolean }>("/api/dev/reset", "POST", { reseed });
      if (!data) return;
      if (reseed) {
        // The reset endpoint re-seeds and signs us in as the demo customer.
        await loadBootstrap();
      } else {
        set({ ...EMPTY_DATA, hasHydrated: true });
      }
    },
  };
});

/* ------------------------------ Selectors ------------------------------ */

/** True once the initial server bootstrap has settled. */
export function useHydrated(): boolean {
  return useBureauStore((s) => s.hasHydrated);
}

export function useCurrentUser(): User | undefined {
  return useBureauStore((s) => s.users.find((u) => u.id === s.sessionUserId));
}

export function useIsAdmin(): boolean {
  return useBureauStore((s) => s.users.find((u) => u.id === s.sessionUserId)?.role === "admin");
}

/** A single case, only if the current user may access it (owner or admin).
 *  (The API only ever returns accessible cases; this guards the cache too.) */
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

/** Whether the current user has accepted the current disclaimer version
 *  (case-specific when a caseId is provided — audit-hardened semantics). */
export function useHasAccepted(caseId?: string | null): boolean {
  return useBureauStore((s) =>
    s.acceptances.some(
      (a) =>
        a.userId === s.sessionUserId &&
        a.version === DISCLAIMER_VERSION &&
        (caseId ? a.caseId === caseId : true),
    ),
  );
}
