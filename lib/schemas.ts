import { z } from "zod";

/**
 * Zod schemas for BureauOS. The first half defines the domain enums and
 * shapes; the second half defines the input schema for every API route —
 * nothing reaches a route handler's logic unvalidated.
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

export const documentRequirementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(["needed", "requested", "obtained", "not_applicable"]),
  required: z.boolean(),
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

export const notificationPreferencesSchema = z.object({
  emailReminders: z.boolean(),
  smsReminders: z.boolean(),
  deadlineAlerts: z.boolean(),
  caseStatusAlerts: z.boolean(),
  missingDocumentReminders: z.boolean(),
  supportTicketUpdates: z.boolean(),
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
  /** Required only when `email` changes the sign-in address. */
  currentPassword: z.string().min(1).max(200).optional(),
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(200),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(10).max(200),
});

export const deleteAccountInputSchema = z.object({
  password: z.string().min(1).max(200),
  /** The user types DELETE — a deliberate act, not a stray click. */
  confirm: z.literal("DELETE"),
});

/** SMS and missing-document reminders are not offered, so they can't be switched on. */
export const prefsUpdateSchema = notificationPreferencesSchema
  .omit({ smsReminders: true, missingDocumentReminders: true })
  .partial();

export const acceptanceInputSchema = z.object({
  id: clientId.optional(),
  caseId: z.string().max(64).nullable(),
});

/** A purchase request names a case and nothing else — never a price or product. */
export const checkoutInputSchema = z.object({
  caseId: z.string().min(1).max(64),
});

export const renderLetterInputSchema = z.object({
  templateId: z.string().min(1).max(80),
  values: z.record(z.string().max(80), z.string().max(5_000)).default({}),
  /** The writer's calendar date (YYYY-MM-DD), used to date the letter. */
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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
  /** Staff override: unlock the Case Pass without a payment (audited). */
  z.object({ type: z.literal("grant_case_pass"), reason: z.string().trim().min(3).max(300) }),
  z.object({ type: z.literal("revoke_case_pass"), reason: z.string().trim().min(3).max(300) }),
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

export const devResetInputSchema = z.object({
  reseed: z.boolean(),
});
