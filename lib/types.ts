/**
 * BureauOS core domain model.
 *
 * Persisted entities (Case and everything nested inside it, plus UserSettings)
 * are plain serializable objects stored in the local data layer (localStorage
 * today, swappable for a real backend later — see lib/store.ts).
 *
 * Navigator definitions (content + rules) live in code under lib/navigators/.
 */

export type NavigatorSlug =
  | "dmv"
  | "job-separation"
  | "small-business"
  | "insurance-denial"
  | "veteran-benefits"
  | "tenant-rights";

export type QuestionType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "date"
  | "boolean"
  | "number"
  | "file"
  | "contact";

export interface IntakeQuestion {
  id: string;
  label: string;
  help?: string;
  type: QuestionType;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  /** Only show this question if a previous answer matches. */
  showIf?: { questionId: string; equals: string | boolean };
}

export type AnswerValue = string | number | boolean | string[] | ContactValue | null;

export interface ContactValue {
  name: string;
  organization?: string;
  phone?: string;
  email?: string;
}

export type CaseStatus =
  | "intake"
  | "planning"
  | "in_progress"
  | "waiting"
  | "resolved"
  | "closed";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  category?: string;
  dueDate?: string;
  createdAt: string;
}

export type DocumentStatus = "needed" | "requested" | "obtained" | "not_applicable";

export interface DocumentRequirement {
  id: string;
  name: string;
  description?: string;
  status: DocumentStatus;
  required: boolean;
}

/**
 * - official       a statutory/agency deadline. It carries a date ONLY when a
 *                  source-checked rule was applied to the actual triggering
 *                  event; otherwise `date` is null → shown as NEEDS VERIFICATION.
 * - self_reported  a date the user copied from their own notice.
 * - suggested      a BureauOS follow-up target. Not a legal deadline.
 */
export type DeadlineKind = "official" | "self_reported" | "suggested";

export interface DeadlineSource {
  ruleId: string;
  jurisdiction: string;
  ruleSummary: string;
  citation: string;
  url: string;
  /** Calendar date the rule text was last checked against the source. */
  checkedOn: string;
  caveats: string;
}

export interface DeadlineTrigger {
  /** Intake answer holding the triggering event's date. */
  questionId: string;
  label: string;
  /** The date the count ran from, or null when it has not been provided. */
  date: string | null;
  mayBeFuture: boolean;
}

export interface Deadline {
  id: string;
  /** Stable identity across plan regenerations (rule id or slugged title). */
  key: string;
  title: string;
  kind: DeadlineKind;
  /** Calendar date `YYYY-MM-DD`, or null when it has not been established. */
  date: string | null;
  note?: string;
  /** The user confirmed this date against their official notice. */
  verified: boolean;
  /** Present on official deadlines backed by a source-checked rule. */
  source?: DeadlineSource;
  /** Present when the deadline is (or could be) calculated from a trigger date. */
  trigger?: DeadlineTrigger;
}

export type TimelineEventType =
  | "case_created"
  | "intake_completed"
  | "plan_generated"
  | "task_completed"
  | "document_update"
  | "letter_generated"
  | "communication"
  | "deadline"
  | "status_change"
  | "note";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  detail?: string;
  date: string;
}

export interface GeneratedLetter {
  id: string;
  templateId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskFlag {
  id: string;
  label: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface ActionPlan {
  generatedAt: string;
  situationSummary: string;
  priority: Priority;
  nextActions: { title: string; detail: string }[];
  riskFlags: RiskFlag[];
  suggestedLetterTemplateId?: string;
  disclaimer: string;
}

export interface CaseIntake {
  answers: Record<string, AnswerValue>;
  currentStep: number;
  completed: boolean;
}

export interface Case {
  id: string;
  /** Owning customer account. */
  userId: string;
  navigatorSlug: NavigatorSlug;
  title: string;
  status: CaseStatus;
  priority: Priority;
  /** Service package applied to this case. */
  serviceTier: ServiceTierId;
  /** Staff member handle (assignment placeholder for operations). */
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  intake: CaseIntake;
  plan: ActionPlan | null;
  tasks: Task[];
  documents: DocumentRequirement[];
  deadlines: Deadline[];
  letters: GeneratedLetter[];
  timeline: TimelineEvent[];
  /** Internal staff notes — never rendered in customer views. */
  adminNotes: AdminNote[];
}

export interface UserSettings {
  displayName: string;
  email: string;
  usState: string;
  demoMode: boolean;
}

/* ------------------------------------------------------------------ */
/* Accounts & roles                                                    */
/* ------------------------------------------------------------------ */

export type UserRole = "customer" | "admin";

export interface NotificationPreferences {
  emailReminders: boolean;
  smsReminders: boolean;
  deadlineAlerts: boolean;
  caseStatusAlerts: boolean;
  missingDocumentReminders: boolean;
  supportTicketUpdates: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** Always "" on the client — the hash never leaves the server. */
  passwordHash: string;
  role: UserRole;
  /** Whether TOTP MFA is enrolled (the secret itself is never serialized). */
  mfaEnabled: boolean;
  usState: string;
  phone: string;
  createdAt: string;
  notificationPrefs: NotificationPreferences;
}

/* ------------------------------------------------------------------ */
/* Service tiers                                                       */
/* ------------------------------------------------------------------ */

export type ServiceTierId =
  | "self_service"
  | "assisted_review"
  | "done_with_you"
  | "priority";

export interface ServiceTierDef {
  id: ServiceTierId;
  name: string;
  tagline: string;
  /** Requires BureauOS staff. Not purchasable; off unless operations enables it. */
  humanAssisted: boolean;
}

/* ------------------------------------------------------------------ */
/* Purchases & entitlements (real payments — Stripe)                   */
/* ------------------------------------------------------------------ */

export type PurchaseStatus =
  | "pending" // checkout session created, not yet paid
  | "paid"
  | "failed"
  | "expired" // checkout session expired unpaid
  | "refunded"
  | "disputed" // chargeback opened — entitlement suspended
  | "dispute_lost";

export interface Purchase {
  id: string;
  userId: string | null;
  caseId: string | null;
  product: string;
  amountCents: number;
  currency: string;
  status: PurchaseStatus;
  /** false = Stripe test mode or a development simulation; no real money moved. */
  livemode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Entitlement {
  id: string;
  userId: string;
  caseId: string;
  product: string;
  status: "active" | "revoked";
  source: "stripe" | "staff_grant" | "dev_simulation";
  grantedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

/**
 * What this deployment can actually do, computed on the server from its
 * configuration. The UI renders from this instead of assuming a service is
 * live — an unconfigured integration is shown as unavailable, never faked.
 */
export interface Capabilities {
  /** "live": real charges. "test": Stripe test mode. "off": not configured. */
  payments: "live" | "test" | "off";
  casePass: { priceCents: number; currency: string; name: string };
  /** Human-assisted packages and professional review are offered. */
  humanReview: boolean;
  /** "live": real provider. "mock": development outbox. "off": nothing is sent. */
  emailDelivery: "live" | "mock" | "off";
  sms: false;
  uploads: false;
  /** Development-only conveniences (demo login, simulated payment, data reset). */
  devTools: boolean;
}

/* ------------------------------------------------------------------ */
/* Support tickets                                                     */
/* ------------------------------------------------------------------ */

export type TicketStatus =
  | "open"
  | "waiting_on_customer"
  | "in_review"
  | "resolved"
  | "closed";

export type TicketCategory =
  | "case_help"
  | "documents"
  | "billing"
  | "technical"
  | "other";

export interface TicketMessage {
  id: string;
  authorRole: "customer" | "staff";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface AdminNote {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  caseId: string | null;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  messages: TicketMessage[];
  internalNotes: AdminNote[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Professional review workflow                                        */
/* ------------------------------------------------------------------ */

export type ReviewStatus =
  | "not_requested"
  | "requested"
  | "awaiting_documents"
  | "in_review"
  | "changes_requested"
  | "completed"
  | "declined";

export interface ReviewRequest {
  id: string;
  caseId: string;
  userId: string;
  status: ReviewStatus;
  customerNotes: string;
  reviewerNotes: AdminNote[];
  requestedAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* File uploads (metadata; bytes go to S3/Supabase Storage/R2 later)   */
/* ------------------------------------------------------------------ */

export type FileCategory =
  | "id_documents"
  | "dmv_notices"
  | "insurance_denial_letters"
  | "lease_documents"
  | "repair_photos"
  | "employment_documents"
  | "final_paycheck_records"
  | "va_claim_documents"
  | "medical_evidence"
  | "business_filings"
  | "tax_compliance"
  | "correspondence";

export type FileStatus = "uploaded" | "pending_review" | "verified" | "rejected";

export interface UploadedFile {
  id: string;
  caseId: string;
  userId: string;
  name: string;
  fileType: string;
  sizeLabel: string;
  category: FileCategory;
  uploadedAt: string;
  status: FileStatus;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Legal onboarding                                                    */
/* ------------------------------------------------------------------ */

export interface DisclaimerAcceptance {
  id: string;
  userId: string;
  caseId: string | null;
  version: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedDisclaimer: boolean;
  acceptedAt: string;
}

/* ------------------------------------------------------------------ */
/* Notifications (mock outbox; Resend/Twilio/SES adapters later)       */
/* ------------------------------------------------------------------ */

export type NotificationEventType =
  | "deadline_alert"
  | "case_status"
  | "missing_document"
  | "support_update"
  | "review_update"
  | "billing_update"
  | "account_security"
  | "welcome";

export interface NotificationEvent {
  id: string;
  userId: string;
  type: NotificationEventType;
  channel: "email" | "sms";
  subject: string;
  body: string;
  createdAt: string;
  /** "mock_sent" — recorded in the local outbox; no real delivery in the MVP. */
  status: "queued" | "mock_sent";
}

/* ------------------------------------------------------------------ */
/* Audit trail (staff actions; server-written, admin read-only)        */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  /** e.g. "case.set_status", "review.add_note", "file.set_status" */
  action: string;
  targetType: "case" | "ticket" | "review" | "file" | "system";
  targetId: string;
  caseId: string | null;
  detail: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Jurisdiction-specific rules framework (seeded samples in code)      */
/* ------------------------------------------------------------------ */

export interface JurisdictionRule {
  id: string;
  state: string;
  county?: string;
  city?: string;
  agency: string;
  navigatorSlug: NavigatorSlug;
  category: string;
  title: string;
  summary: string;
  deadlineType?: string;
  deadlineDetail?: string;
  requiredDocuments: string[];
  processSteps: string[];
  officialLinks: { label: string; url: string }[];
  disclaimer: string;
  lastUpdated: string;
  /**
   * "source_checked": text checked against the linked source on `lastUpdated`
   * (an engineering check, pending counsel review) — shown to customers.
   * "unverified_sample": illustrative content, never shown as guidance.
   */
  reviewStatus: "source_checked" | "unverified_sample";
}

/* ------------------------------------------------------------------ */
/* Navigator content model (defined in code, not persisted)            */
/* ------------------------------------------------------------------ */

export interface TaskTemplate {
  title: string;
  description?: string;
  category?: string;
  /** Suggested due date, in days from plan generation. */
  dueInDays?: number;
}

export interface DocumentTemplate {
  name: string;
  description?: string;
  required: boolean;
}

/**
 * What a navigator's rule logic may ask the plan engine to track. Note what
 * is NOT expressible here: an "official" deadline with a hand-picked date.
 * Official dates come only from the rule registry (lib/deadline-rules.ts).
 */
export type DeadlineSpec =
  /** A follow-up target N days out. Labeled as a suggestion, never as a deadline. */
  | { kind: "suggested"; title: string; inDays: number; note?: string }
  /** A date the user entered from their own notice (an intake answer). */
  | { kind: "self_reported"; title: string; date: unknown; note?: string }
  /** A source-checked rule; the engine calculates it or marks it NEEDS VERIFICATION. */
  | { kind: "official"; ruleId: string; note?: string }
  /** A real deadline exists but BureauOS has no verified rule for it — always NEEDS VERIFICATION. */
  | { kind: "official_unavailable"; key: string; title: string; note: string };

export interface LetterField {
  id: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Prefill from an intake answer with this question id. */
  fromAnswer?: string;
}

/**
 * Letter template metadata — what the form needs. The letter text itself is
 * NOT here: navigator content ships to the browser, so the bodies live in the
 * server-only lib/server/letters.ts and are rendered after an entitlement check.
 */
export interface LetterTemplate {
  id: string;
  name: string;
  description: string;
  fields: LetterField[];
}

/** Renders a letter body. Values keyed by field id; blanks become [BRACKETED PROMPTS]. */
export type LetterRenderer = (values: Record<string, string>, ctx: LetterContext) => string;

export interface LetterContext {
  senderName: string;
  todayLong: string;
  caseTitle: string;
}

export interface PlanResult {
  situationSummary: string;
  priority: Priority;
  nextActions: { title: string; detail: string }[];
  extraTasks: TaskTemplate[];
  extraDocuments: DocumentTemplate[];
  deadlines: DeadlineSpec[];
  riskFlags: Omit<RiskFlag, "id">[];
  suggestedLetterTemplateId?: string;
  timelineEntries: { title: string; detail?: string }[];
}

export interface NavigatorDef {
  slug: NavigatorSlug;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  /** Lucide icon key resolved in components/navigator-icon.tsx */
  icon: string;
  accent: string; // tailwind-safe hsl string for badges/accents
  /**
   * "live": validated for the commercial launch. "preview": general
   * organization tools only — no paid products, no verified deadline rules.
   */
  launchStatus: "live" | "preview";
  problems: string[];
  questions: IntakeQuestion[];
  baseTasks: TaskTemplate[];
  baseDocuments: DocumentTemplate[];
  letterTemplates: LetterTemplate[];
  disclaimer: string;
  buildPlan: (answers: Record<string, AnswerValue>) => PlanResult;
}
