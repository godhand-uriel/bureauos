import { z } from "zod";

/**
 * Zod schemas for persisted BureauOS data. Used to validate anything read
 * back from the local data layer so corrupted storage never crashes the app.
 */

export const contactValueSchema = z.object({
  name: z.string(),
  organization: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  contactValueSchema,
  z.null(),
]);

export const caseStatusSchema = z.enum([
  "intake",
  "planning",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
]);

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  done: z.boolean(),
  category: z.string().optional(),
  dueDate: z.string().optional(),
  createdAt: z.string(),
});

export const documentRequirementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(["needed", "requested", "obtained", "not_applicable"]),
  required: z.boolean(),
});

export const deadlineSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  note: z.string().optional(),
  verified: z.boolean(),
});

export const timelineEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "case_created",
    "intake_completed",
    "plan_generated",
    "task_completed",
    "document_update",
    "letter_generated",
    "communication",
    "deadline",
    "status_change",
    "note",
  ]),
  title: z.string(),
  detail: z.string().optional(),
  date: z.string(),
});

export const generatedLetterSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const riskFlagSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});

export const actionPlanSchema = z.object({
  generatedAt: z.string(),
  situationSummary: z.string(),
  priority: prioritySchema,
  nextActions: z.array(z.object({ title: z.string(), detail: z.string() })),
  riskFlags: z.array(riskFlagSchema),
  suggestedLetterTemplateId: z.string().optional(),
  disclaimer: z.string(),
});

export const serviceTierIdSchema = z.enum([
  "self_service",
  "assisted_review",
  "done_with_you",
  "priority",
]);

export const adminNoteSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const caseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  navigatorSlug: z.enum([
    "dmv",
    "job-separation",
    "small-business",
    "insurance-denial",
    "veteran-benefits",
    "tenant-rights",
  ]),
  title: z.string(),
  status: caseStatusSchema,
  priority: prioritySchema,
  serviceTier: serviceTierIdSchema,
  assignedTo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  intake: z.object({
    answers: z.record(z.string(), answerValueSchema),
    currentStep: z.number(),
    completed: z.boolean(),
  }),
  plan: actionPlanSchema.nullable(),
  tasks: z.array(taskSchema),
  documents: z.array(documentRequirementSchema),
  deadlines: z.array(deadlineSchema),
  letters: z.array(generatedLetterSchema),
  timeline: z.array(timelineEventSchema),
  adminNotes: z.array(adminNoteSchema),
});

/** Legacy v1 case shape (pre-accounts) — used only for one-time migration. */
export const legacyCaseSchema = caseSchema.omit({
  userId: true,
  serviceTier: true,
  assignedTo: true,
  adminNotes: true,
});

export const notificationPreferencesSchema = z.object({
  emailReminders: z.boolean(),
  smsReminders: z.boolean(),
  deadlineAlerts: z.boolean(),
  caseStatusAlerts: z.boolean(),
  missingDocumentReminders: z.boolean(),
  supportTicketUpdates: z.boolean(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  role: z.enum(["customer", "admin"]),
  usState: z.string(),
  phone: z.string(),
  createdAt: z.string(),
  notificationPrefs: notificationPreferencesSchema,
});

export const subscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tier: serviceTierIdSchema,
  status: z.enum(["active", "canceled"]),
  startedAt: z.string(),
  updatedAt: z.string(),
  history: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      amountLabel: z.string(),
      date: z.string(),
      kind: z.enum(["mock_charge", "mock_refund", "plan_change"]),
    }),
  ),
});

export const supportTicketSchema = z.object({
  id: z.string(),
  userId: z.string(),
  caseId: z.string().nullable(),
  category: z.enum(["case_help", "documents", "billing", "technical", "other"]),
  subject: z.string(),
  status: z.enum(["open", "waiting_on_customer", "in_review", "resolved", "closed"]),
  messages: z.array(
    z.object({
      id: z.string(),
      authorRole: z.enum(["customer", "staff"]),
      authorName: z.string(),
      body: z.string(),
      createdAt: z.string(),
    }),
  ),
  internalNotes: z.array(adminNoteSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reviewRequestSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  userId: z.string(),
  status: z.enum([
    "not_requested",
    "requested",
    "awaiting_documents",
    "in_review",
    "changes_requested",
    "completed",
    "declined",
  ]),
  customerNotes: z.string(),
  reviewerNotes: z.array(adminNoteSchema),
  requestedAt: z.string(),
  updatedAt: z.string(),
});

export const uploadedFileSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  userId: z.string(),
  name: z.string(),
  fileType: z.string(),
  sizeLabel: z.string(),
  category: z.enum([
    "id_documents",
    "dmv_notices",
    "insurance_denial_letters",
    "lease_documents",
    "repair_photos",
    "employment_documents",
    "final_paycheck_records",
    "va_claim_documents",
    "medical_evidence",
    "business_filings",
    "tax_compliance",
    "correspondence",
  ]),
  uploadedAt: z.string(),
  status: z.enum(["uploaded", "pending_review", "verified", "rejected"]),
  notes: z.string(),
});

export const disclaimerAcceptanceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  caseId: z.string().nullable(),
  version: z.string(),
  acceptedTerms: z.boolean(),
  acceptedPrivacy: z.boolean(),
  acceptedDisclaimer: z.boolean(),
  acceptedAt: z.string(),
});

export const notificationEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum([
    "deadline_alert",
    "case_status",
    "missing_document",
    "support_update",
    "review_update",
    "billing_update",
    "welcome",
  ]),
  channel: z.enum(["email", "sms"]),
  subject: z.string(),
  body: z.string(),
  createdAt: z.string(),
  status: z.enum(["queued", "mock_sent"]),
});

/** v2 persisted state: user-scoped, customer-service platform shape. */
export const persistedStateSchema = z.object({
  users: z.array(userSchema),
  sessionUserId: z.string().nullable(),
  cases: z.array(caseSchema),
  subscriptions: z.array(subscriptionSchema),
  tickets: z.array(supportTicketSchema),
  reviews: z.array(reviewRequestSchema),
  files: z.array(uploadedFileSchema),
  acceptances: z.array(disclaimerAcceptanceSchema),
  notifications: z.array(notificationEventSchema),
  seeded: z.boolean(),
  migratedV1: z.boolean(),
});

export type PersistedState = z.infer<typeof persistedStateSchema>;

/** Legacy v1 persisted state — used only for one-time migration. */
export const legacyPersistedStateSchema = z.object({
  cases: z.array(legacyCaseSchema),
  settings: z
    .object({
      displayName: z.string(),
      email: z.string(),
      usState: z.string(),
      demoMode: z.boolean(),
    })
    .optional(),
  seeded: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/* API input schemas (validated at every route boundary)               */
/* ------------------------------------------------------------------ */

/** Client-generated ids are accepted for nested entities so optimistic UI
 *  updates and server rows stay identical. */
const clientId = z.string().min(8).max(64);

export const navigatorSlugSchema = z.enum([
  "dmv",
  "job-separation",
  "small-business",
  "insurance-denial",
  "veteran-benefits",
  "tenant-rights",
]);

export const signupInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(10).max(200),
  usState: z.string().trim().max(60).default(""),
});

export const loginInputSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  /** TOTP code — required when the account has MFA enrolled. */
  totp: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export const mfaVerifyInputSchema = z.object({
  code: z.string().trim().min(6).max(12),
});

export const demoLoginInputSchema = z.object({
  role: z.enum(["customer", "admin"]),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  usState: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const prefsUpdateSchema = notificationPreferencesSchema.partial();

export const acceptanceInputSchema = z.object({
  id: clientId.optional(),
  caseId: z.string().max(64).nullable(),
});

export const billingInputSchema = z.object({
  tier: serviceTierIdSchema,
});

export const createCaseInputSchema = z.object({
  navigatorSlug: navigatorSlugSchema,
  title: z.string().trim().max(200).optional(),
});

const bodyText = z.string().trim().min(1).max(10_000);

export const caseActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_status"), status: caseStatusSchema }),
  z.object({ type: z.literal("set_tier"), tier: serviceTierIdSchema }),
  z.object({ type: z.literal("assign"), staffName: z.string().trim().max(120).nullable() }),
  z.object({ type: z.literal("add_admin_note"), id: clientId.optional(), body: bodyText }),
  z.object({
    type: z.literal("save_intake"),
    answers: z.record(z.string().max(80), answerValueSchema),
    step: z.number().int().min(0).max(200),
  }),
  z.object({ type: z.literal("complete_intake") }),
  z.object({ type: z.literal("reopen_intake") }),
  z.object({ type: z.literal("regenerate_plan") }),
  z.object({
    type: z.literal("set_trigger_date"),
    questionId: z.string().min(1).max(80),
    /** Calendar date, YYYY-MM-DD. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({ type: z.literal("toggle_task"), taskId: clientId }),
  z.object({ type: z.literal("add_task"), id: clientId, title: z.string().trim().min(1).max(300) }),
  z.object({
    type: z.literal("set_document_status"),
    docId: clientId,
    status: documentRequirementSchema.shape.status,
  }),
  z.object({ type: z.literal("toggle_deadline"), deadlineId: clientId }),
  z.object({
    type: z.literal("add_timeline_event"),
    id: clientId,
    eventType: timelineEventSchema.shape.type,
    title: z.string().trim().min(1).max(300),
    detail: z.string().trim().max(2_000).optional(),
  }),
  z.object({
    type: z.literal("save_letter"),
    id: clientId,
    templateId: z.string().max(80),
    title: z.string().trim().min(1).max(200),
    letterBody: z.string().min(1).max(50_000),
  }),
  z.object({ type: z.literal("update_letter"), letterId: clientId, letterBody: z.string().min(1).max(50_000) }),
  z.object({ type: z.literal("delete_letter"), letterId: clientId }),
]);

export type CaseActionInput = z.infer<typeof caseActionSchema>;

export const createTicketInputSchema = z.object({
  caseId: z.string().max(64).nullable(),
  category: supportTicketSchema.shape.category,
  subject: z.string().trim().min(1).max(300),
  body: bodyText,
});

export const ticketActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_message"), id: clientId.optional(), body: bodyText }),
  z.object({ type: z.literal("set_status"), status: supportTicketSchema.shape.status }),
  z.object({ type: z.literal("add_internal_note"), id: clientId.optional(), body: bodyText }),
]);

export type TicketActionInput = z.infer<typeof ticketActionSchema>;

export const createReviewInputSchema = z.object({
  caseId: z.string().max(64),
  customerNotes: bodyText,
});

export const reviewActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_status"), status: reviewRequestSchema.shape.status }),
  z.object({ type: z.literal("add_note"), id: clientId.optional(), body: bodyText }),
]);

export type ReviewActionInput = z.infer<typeof reviewActionSchema>;

export const createFileInputSchema = z.object({
  id: clientId.optional(),
  caseId: z.string().max(64),
  name: z.string().trim().min(1).max(300),
  fileType: z.string().max(150),
  sizeLabel: z.string().max(40),
  category: uploadedFileSchema.shape.category,
  notes: z.string().max(1_000).default(""),
});

export const fileUpdateInputSchema = z.object({
  status: uploadedFileSchema.shape.status,
  notes: z.string().max(1_000).optional(),
});

export const devResetInputSchema = z.object({
  reseed: z.boolean(),
});
