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

export interface Deadline {
  id: string;
  title: string;
  date: string;
  note?: string;
  /** Deadlines from the rule engine are estimates the user must verify. */
  verified: boolean;
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
  /** Demo-grade local hash. Replaced entirely by Clerk/Supabase/Auth.js in production. */
  passwordHash: string;
  role: UserRole;
  usState: string;
  phone: string;
  createdAt: string;
  notificationPrefs: NotificationPreferences;
}

/* ------------------------------------------------------------------ */
/* Service packages & billing                                          */
/* ------------------------------------------------------------------ */

export type ServiceTierId =
  | "self_service"
  | "assisted_review"
  | "done_with_you"
  | "priority";

export interface ServiceTierDef {
  id: ServiceTierId;
  name: string;
  priceLabel: string;
  priceMonthly: number;
  tagline: string;
  included: string[];
  notIncluded: string[];
  humanAssisted: boolean;
  highlight?: boolean;
}

export type SubscriptionStatus = "active" | "canceled";

export interface BillingHistoryEntry {
  id: string;
  label: string;
  amountLabel: string;
  date: string;
  kind: "mock_charge" | "mock_refund" | "plan_change";
}

export interface Subscription {
  id: string;
  userId: string;
  tier: ServiceTierId;
  status: SubscriptionStatus;
  startedAt: string;
  updatedAt: string;
  history: BillingHistoryEntry[];
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

export interface DeadlineTemplate {
  title: string;
  inDays: number;
  note?: string;
}

export interface LetterField {
  id: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Prefill from an intake answer with this question id. */
  fromAnswer?: string;
}

export interface LetterTemplate {
  id: string;
  name: string;
  description: string;
  fields: LetterField[];
  /** Render the letter body. Values keyed by field id; blanks become [BRACKETED PROMPTS]. */
  render: (values: Record<string, string>, ctx: LetterContext) => string;
}

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
  deadlines: DeadlineTemplate[];
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
  problems: string[];
  questions: IntakeQuestion[];
  baseTasks: TaskTemplate[];
  baseDocuments: DocumentTemplate[];
  letterTemplates: LetterTemplate[];
  disclaimer: string;
  buildPlan: (answers: Record<string, AnswerValue>) => PlanResult;
}
