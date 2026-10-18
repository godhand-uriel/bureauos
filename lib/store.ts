"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { signIn as authSignIn, signOut as authSignOut } from "next-auth/react";
import type {
  AnswerValue,
  AuditEntry,
  Capabilities,
  Case,
  CaseStatus,
  DisclaimerAcceptance,
  DocumentStatus,
  Entitlement,
  GeneratedLetter,
  NavigatorSlug,
  NotificationEvent,
  NotificationPreferences,
  Purchase,
  ReviewRequest,
  ReviewStatus,
  ServiceTierId,
  SupportTicket,
  TicketCategory,
  TicketStatus,
  TimelineEventType,
  User,
  UserRole,
} from "@/lib/types";
import { uid } from "@/lib/utils";
import { CASE_PASS } from "@/lib/launch";
import { todayLocal } from "@/lib/dates";
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
 * Nothing case/ticket/review/purchase/acceptance-related is persisted in
 * localStorage — the session lives in an httpOnly cookie and data reloads
 * from the API. Authorization AND entitlements are enforced server-side; the
 * client checks that remain (including `useCasePass`) are UX, not security.
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
  entitlements: Entitlement[];
  purchases: Purchase[];
  acceptances: DisclaimerAcceptance[];
  notifications: NotificationEvent[];
  auditLog: AuditEntry[];
  capabilities: Capabilities;
}

export type ActionOutcome = { ok: true } | { ok: false; error: string };

/* --------------------------------- store ------------------------------- */

interface BureauState {
  users: User[];
  sessionUserId: string | null;
  cases: Case[];
  /** Per-case paid entitlements — display only; the server re-checks every paid action. */
  entitlements: Entitlement[];
  purchases: Purchase[];
  tickets: SupportTicket[];
  reviews: ReviewRequest[];
  acceptances: DisclaimerAcceptance[];
  notifications: NotificationEvent[];
  /** Staff-only audit trail (empty for customer sessions). */
  auditLog: AuditEntry[];
  /** What this deployment can actually do (null until the first bootstrap). */
  capabilities: Capabilities | null;
  /** True once the initial bootstrap fetch has settled (signed in or not). */
  hasHydrated: boolean;

  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;

  // Auth (Auth.js sessions; enforced server-side)
  signUp: (name: string, email: string, password: string, usState: string) => Promise<{ ok: boolean; error?: string }>;
  logIn: (email: string, password: string, totp?: string) => Promise<{ ok: boolean; error?: string }>;
  logInDemo: (role: UserRole) => Promise<void>;
  logOut: () => Promise<void>;
  // Save profile fields. Changing the sign-in email requires the current password.
  saveProfile: (
    partial: Partial<Pick<User, "name" | "email" | "usState">>,
    currentPassword?: string,
  ) => Promise<ActionOutcome>;
  // Change the password. Every session (this one included) is signed out on success.
  changePassword: (currentPassword: string, newPassword: string) => Promise<ActionOutcome>;
  // Permanently delete the account and its data. Signs out on success.
  deleteAccount: (password: string) => Promise<ActionOutcome>;
  updateNotificationPrefs: (partial: Partial<NotificationPreferences>) => void;

  // Legal
  acceptDisclaimers: (caseId: string | null) => Promise<void>;

  // Purchases (Stripe Checkout). Nothing here can grant access: the server
  // creates the session, and only its verified webhook activates a Case Pass.
  /** Ask the server for a Stripe Checkout URL for this case's Case Pass. */
  startCheckout: (caseId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  /** Read what the webhook has recorded for a returned checkout session. */
  checkoutStatus: (sessionId: string) => Promise<{ status: string; caseId: string | null; entitled: boolean } | null>;
  /** Development only (the route 404s in production). */
  simulateDevPayment: (caseId: string) => Promise<ActionOutcome>;
  /** Staff: grant / remove a Case Pass (audited server-side). */
  grantCasePass: (caseId: string, reason: string) => Promise<ActionOutcome>;
  revokeCasePass: (caseId: string, reason: string) => Promise<ActionOutcome>;

  // Cases
  createCase: (slug: NavigatorSlug, title?: string) => Promise<Case | null>;
  deleteCase: (id: string) => void;
  setCaseStatus: (id: string, status: CaseStatus, actor?: "customer" | "staff") => void;
  setCaseServiceTier: (id: string, tier: ServiceTierId) => void;
  assignCase: (id: string, staffName: string | null) => void;
  addCaseAdminNote: (id: string, authorName: string, body: string) => void;
  saveIntakeProgress: (id: string, answers: Record<string, AnswerValue>, step: number) => Promise<void>;
  completeIntake: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Reopen a completed intake so answers can be updated (plan recalculates on completion). */
  reopenIntake: (id: string) => Promise<void>;
  /** Record the real triggering date for a deadline; the server recalculates. */
  setTriggerDate: (id: string, questionId: string, date: string) => Promise<{ ok: boolean; error?: string }>;
  regeneratePlan: (id: string) => void;
  toggleTask: (id: string, taskId: string) => void;
  addTask: (id: string, title: string) => void;
  setDocumentStatus: (id: string, docId: string, status: DocumentStatus) => void;
  toggleDeadlineVerified: (id: string, deadlineId: string) => void;
  addTimelineEvent: (id: string, type: TimelineEventType, title: string, detail?: string) => void;
  /** Render a letter on the server (entitlement-checked; the text never ships in the bundle). */
  renderLetter: (
    id: string,
    templateId: string,
    values: Record<string, string>,
  ) => Promise<{ ok: true; body: string } | { ok: false; error: string; needsCasePass: boolean }>;
  saveLetter: (id: string, letter: Omit<GeneratedLetter, "id" | "createdAt" | "updatedAt">) => Promise<ActionOutcome>;
  updateLetter: (id: string, letterId: string, body: string) => void;
  deleteLetter: (id: string, letterId: string) => void;

  // Support
  createTicket: (input: { caseId: string | null; category: TicketCategory; subject: string; body: string }) => Promise<SupportTicket | null>;
  addTicketMessage: (ticketId: string, authorRole: "customer" | "staff", authorName: string, body: string) => void;
  setTicketStatus: (ticketId: string, status: TicketStatus) => void;
  addTicketInternalNote: (ticketId: string, authorName: string, body: string) => void;

  // Professional review
  requestReview: (caseId: string, customerNotes: string) => Promise<void>;
  setReviewStatus: (reviewId: string, status: ReviewStatus) => void;
  addReviewerNote: (reviewId: string, authorName: string, body: string) => void;

  // Development only (the route is 404 in production).
  resetAllData: (reseed: boolean) => Promise<void>;
}

const EMPTY_DATA = {
  users: [] as User[],
  sessionUserId: null as string | null,
  cases: [] as Case[],
  entitlements: [] as Entitlement[],
  purchases: [] as Purchase[],
  tickets: [] as SupportTicket[],
  reviews: [] as ReviewRequest[],
  acceptances: [] as DisclaimerAcceptance[],
  notifications: [] as NotificationEvent[],
  auditLog: [] as AuditEntry[],
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

  /** Server-authoritative case action that reports the server's error message. */
  const caseActionResult = async (
    id: string,
    action: Record<string, unknown>,
  ): Promise<ActionOutcome> => {
    const seq = nextSeq(`case:${id}`);
    try {
      const res = await fetch(`/api/cases/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: typeof data.error === "string" ? data.error : "That didn't work. Try again." };
      }
      if (isLatest(`case:${id}`, seq)) {
        replaceCase((data as CaseActionResponse).case);
        mergeNotifications((data as CaseActionResponse).notifications);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — check your connection and try again." };
    }
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
    capabilities: null,
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
    // Sign-in/out go through Auth.js (CSRF-protected credentials flow, JWT
    // session cookie). Account creation stays a plain validated route.

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
      const signin = await authSignIn("credentials", { email, password, redirect: false });
      if (signin?.error) {
        return { ok: false, error: "Account created, but sign-in failed. Try logging in." };
      }
      await loadBootstrap();
      return { ok: true };
    },

    logIn: async (email, password, totp) => {
      const res = await authSignIn("credentials", {
        email,
        password,
        ...(totp ? { totp } : {}),
        redirect: false,
      }).catch(() => null);
      if (!res) return { ok: false, error: "Network error — is the server running?" };
      if (res.error) {
        return {
          ok: false,
          error:
            "Sign-in failed. Check your email and password — and if your account has MFA enabled, include the current authenticator code.",
        };
      }
      await loadBootstrap();
      return { ok: true };
    },

    logInDemo: async (role) => {
      // Ensure demo data exists, then sign in with the (public) demo creds.
      await apiFetch("/api/auth/demo", "POST", {});
      await authSignIn("credentials", {
        email: role === "admin" ? DEMO_ADMIN_EMAIL : DEMO_CUSTOMER_EMAIL,
        password: DEMO_PASSWORD,
        redirect: false,
      });
      await loadBootstrap();
    },

    logOut: async () => {
      await authSignOut({ redirect: false });
      set({ ...EMPTY_DATA, hasHydrated: true });
    },

    saveProfile: async (partial, currentPassword) => {
      try {
        const res = await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...partial, ...(currentPassword ? { currentPassword } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: typeof data.error === "string" ? data.error : "Couldn't save. Check the fields and try again." };
        }
        const saved = (data as { user: User }).user;
        set({ users: get().users.map((u) => (u.id === saved.id ? saved : u)) });
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — check your connection and try again." };
      }
    },

    changePassword: async (currentPassword, newPassword) => {
      try {
        const res = await fetch("/api/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            error:
              typeof data.error === "string" && data.error !== "Invalid request."
                ? data.error
                : "Couldn't change the password. New passwords need at least 10 characters.",
          };
        }
        // The server invalidated every session for this account, this one included.
        await authSignOut({ redirect: false });
        set({ ...EMPTY_DATA, hasHydrated: true });
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — check your connection and try again." };
      }
    },

    deleteAccount: async (password) => {
      try {
        const res = await fetch("/api/me", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, confirm: "DELETE" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: typeof data.error === "string" ? data.error : "Couldn't delete the account." };
        }
        await authSignOut({ redirect: false });
        set({ ...EMPTY_DATA, hasHydrated: true });
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — check your connection and try again." };
      }
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

    /* -------------------------- Purchases ------------------------- */

    startCheckout: async (caseId) => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.url !== "string") {
          return { ok: false, error: typeof data.error === "string" ? data.error : "Could not start checkout." };
        }
        return { ok: true, url: data.url };
      } catch {
        return { ok: false, error: "Network error — check your connection and try again." };
      }
    },

    checkoutStatus: async (sessionId) => {
      const data = await apiFetch<{ status: string; caseId: string | null; entitled: boolean }>(
        `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
        "GET",
      );
      if (data?.entitled) await loadBootstrap();
      return data;
    },

    simulateDevPayment: async (caseId) => {
      try {
        const res = await fetch("/api/dev/simulate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: typeof data.error === "string" ? data.error : "Not available." };
        await loadBootstrap();
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — check your connection and try again." };
      }
    },

    grantCasePass: async (caseId, reason) => {
      const result = await caseActionResult(caseId, { type: "grant_case_pass", reason });
      if (result.ok) await loadBootstrap();
      return result;
    },

    revokeCasePass: async (caseId, reason) => {
      const result = await caseActionResult(caseId, { type: "revoke_case_pass", reason });
      if (result.ok) await loadBootstrap();
      return result;
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
        entitlements: get().entitlements.filter((e) => e.caseId !== id),
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

    // Server-authoritative: the rule engine runs on the server against the
    // saved answers; the response carries the plan, tasks, documents, and
    // deadlines. Await before navigating to the plan page.
    completeIntake: (id) => caseActionResult(id, { type: "complete_intake" }),

    reopenIntake: async (id) => {
      await caseActionResult(id, { type: "reopen_intake" });
    },

    setTriggerDate: (id, questionId, date) =>
      caseActionResult(id, { type: "set_trigger_date", questionId, date }),

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

    renderLetter: async (id, templateId, values) => {
      try {
        const res = await fetch(`/api/cases/${id}/letters/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, values, localDate: todayLocal() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.body !== "string") {
          return {
            ok: false,
            error: typeof data.error === "string" ? data.error : "Could not generate the letter. Try again.",
            needsCasePass: res.status === 402,
          };
        }
        return { ok: true, body: data.body };
      } catch {
        return { ok: false, error: "Network error — check your connection and try again.", needsCasePass: false };
      }
    },

    // Not optimistic: saving is entitlement-checked on the server, so the
    // letter appears in the case only once the server has accepted it.
    saveLetter: (id, letter) =>
      caseActionResult(id, {
        type: "save_letter",
        id: uid(),
        templateId: letter.templateId,
        title: letter.title,
        letterBody: letter.body,
      }),

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
      // The wipe deleted our account, so the old session is dead either way.
      await authSignOut({ redirect: false });
      if (reseed) {
        await authSignIn("credentials", {
          email: DEMO_CUSTOMER_EMAIL,
          password: DEMO_PASSWORD,
          redirect: false,
        });
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

/** Whether a case has an active Case Pass. Display only — the server decides. */
export function useCasePass(caseId: string): boolean {
  return useBureauStore((s) =>
    s.entitlements.some((e) => e.caseId === caseId && e.product === CASE_PASS && e.status === "active"),
  );
}

export function useCapabilities(): Capabilities | null {
  return useBureauStore((s) => s.capabilities);
}

/** Purchases made by the signed-in user, newest first. */
export function useMyPurchases(): Purchase[] {
  const purchases = useBureauStore((s) => s.purchases);
  const sessionUserId = useBureauStore((s) => s.sessionUserId);
  return useMemo(() => purchases.filter((p) => p.userId === sessionUserId), [purchases, sessionUserId]);
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
