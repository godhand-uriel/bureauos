import type { LetterRenderer, NavigatorSlug } from "@/lib/types";

/**
 * Letter bodies — SERVER ONLY.
 *
 * The navigator content files (lib/navigators) are imported by client
 * components, so anything in them ships to every browser. Letter text lives
 * here instead and is rendered by POST /api/cases/[id]/letters/render, which
 * checks the case's entitlement first. That keeps the paid letter generator
 * genuinely server-enforced rather than hidden behind a client-side flag.
 *
 * Keys must match the template ids in lib/navigators/<slug>.ts
 * (tests/letters.test.ts asserts the two stay in step).
 * Values keyed by field id; blanks become [BRACKETED PROMPTS].
 */
const RENDERERS: Record<NavigatorSlug, Record<string, LetterRenderer>> = {
  "dmv": {
    "dmv-records-request": (v, ctx) => `${ctx.todayLong}

To: ${v.dmv_office || "[DMV OFFICE NAME AND ADDRESS]"}

Re: Request for Driving Record and Account Status
Driver License Number: ${v.license_number || "[LICENSE NUMBER]"}
Date of Birth: ${v.dob || "[DATE OF BIRTH]"}

To Whom It May Concern:

I am writing to request a complete copy of my driving record, along with a written summary of any holds, suspensions, outstanding fees, or requirements currently associated with my license or vehicle registration.

${v.issue_summary ? `For context: ${v.issue_summary}` : "[BRIEFLY DESCRIBE YOUR ISSUE]"}

Specifically, I am requesting:
1. My complete driving record.
2. An itemized list of any outstanding fees or fines.
3. The specific steps and documents required to resolve any hold or suspension on my record.
4. Any deadlines that apply to my situation.

Please send the requested records to the address below. If any fee is required to process this request, please let me know the amount and accepted payment methods.

Thank you for your assistance.

Sincerely,

${ctx.senderName}
${v.return_address || "[YOUR MAILING ADDRESS]"}`,
  },
  "job-separation": {
    "final-paycheck-followup": (v, ctx) => `${ctx.todayLong}

To: ${v.employer_name || "[EMPLOYER / HR CONTACT]"}
${v.employer_address || "[EMPLOYER ADDRESS]"}

Re: Final Paycheck and Outstanding Compensation

Dear ${v.employer_name || "[HR CONTACT]"},

My employment ended on ${v.last_day || "[LAST DAY OF WORK]"}. I am writing to follow up on my final compensation, which I have not yet received in full.

Based on my records, the following remains outstanding:
${v.amounts_owed || "[LIST WAGES, UNUSED PTO, REIMBURSEMENTS, OR COMMISSIONS OWED]"}

Please treat this letter as a written request for payment of all final wages owed. Confirm in writing when I can expect payment, or provide an itemized statement if you believe these amounts have already been paid. I would like to resolve this promptly and amicably.

You can reach me at the address below. Thank you for your attention to this matter.

Sincerely,

${ctx.senderName}
${v.return_address || "[YOUR MAILING ADDRESS]"}`,
    "cobra-notice-request": (v, ctx) => `${ctx.todayLong}

To: ${v.recipient || "[EMPLOYER / PLAN ADMINISTRATOR]"}
${v.recipient_address || "[ADDRESS]"}

Re: Request for Health Coverage Information and Continuation Coverage Election Notice
Plan: ${v.plan_name || "[HEALTH PLAN NAME, IF KNOWN]"}

To Whom It May Concern:

My employment ended on ${v.last_day || "[LAST DAY OF WORK]"}. I was enrolled in the employer's group health plan. I am writing to request, in writing:

1. The date my coverage under the plan ends (or ended).
2. My continuation coverage (COBRA or state continuation) election notice, including the election deadline, the premium amount, and where to send payment.
3. The name and contact information of the plan administrator, if it is not you.

If an election notice has already been sent, please tell me the date it was sent and the address it was sent to, and provide a copy.

Please send your response to the address below. Thank you for your prompt attention.

Sincerely,

${ctx.senderName}
${v.return_address || "[YOUR MAILING ADDRESS]"}`,
    "unemployment-appeal-statement": (v, ctx) => `${ctx.todayLong}

To: ${v.agency || "[APPEALS OFFICE NAME AND ADDRESS — COPY FROM YOUR NOTICE]"}

Re: Appeal of Determination
Claimant: ${ctx.senderName}
Claimant ID: ${v.claimant_id || "[CLAIMANT ID FROM YOUR NOTICE]"}
Determination distributed: ${v.determination_date || "[DISTRIBUTED DATE ON THE DETERMINATION]"}
Issue / determination number: ${v.issue_number || "[NUMBER FROM YOUR NOTICE]"}

To Whom It May Concern:

I am appealing the determination identified above. I disagree with the determination and request an appeal hearing.

I disagree with the determination for the following reasons:
${v.reasons || "[STATE BRIEFLY AND FACTUALLY WHY THE DETERMINATION IS WRONG]"}

Please send all notices about this appeal to me at:
${v.contact || "[YOUR MAILING ADDRESS, PHONE, AND EMAIL]"}

Sincerely,

${ctx.senderName}`,
  },
  "small-business": {
    "compliance-memo": (v, ctx) => `INTERNAL COMPLIANCE MEMO

Business: ${v.business_name || "[BUSINESS NAME]"}
Date: ${ctx.todayLong}
Prepared by: ${ctx.senderName}

RE: ${v.obligation || "[OBLIGATION / FILING NAME]"}

Due date: ${v.due_date || "[DUE DATE — VERIFY WITH THE STATE]"}
Responsible: ${v.owner || "[RESPONSIBLE PERSON]"}

Details and plan:
${v.details || "[STEPS, PORTAL LINKS, FEES, AND DOCUMENTS NEEDED]"}

Action items:
1. Confirm the exact due date and fee with the filing authority.
2. Gather required information before the filing window opens.
3. File, pay, and save the confirmation to the compliance folder.
4. Add next year's date to the compliance calendar.

This memo documents our awareness of the obligation as of the date above.`,
  },
  "insurance-denial": {
    "insurance-appeal": (v, ctx) => `${ctx.todayLong}

${v.insurer_name || "[INSURER / APPEALS DEPARTMENT]"}
${v.insurer_address || "[APPEALS MAILING ADDRESS]"}

Re: FORMAL APPEAL of Claim Denial
Policy Number: ${v.policy_number || "[POLICY NUMBER]"}
Claim Number: ${v.claim_number || "[CLAIM NUMBER]"}
Denial Letter Dated: ${v.denial_date || "[DENIAL DATE]"}

To Whom It May Concern:

I am writing to formally appeal the denial of the claim referenced above. Please treat this letter as a request for a full internal review of the decision.

The denial letter states the claim was denied because:
${v.denial_reason || "[QUOTE THE DENIAL REASON FROM THE LETTER]"}

I believe this denial is incorrect for the following reasons:
${v.argument || "[EXPLAIN WHY THE CLAIM SHOULD BE COVERED — REFERENCE POLICY LANGUAGE AND FACTS]"}

In support of this appeal, I am enclosing:
${v.evidence_list || "[LIST EACH ENCLOSED DOCUMENT]"}

I request that you:
1. Conduct a full review of this claim, including all enclosed documentation.
2. Provide the specific policy provisions relied upon if the denial is upheld.
3. Provide a copy of all documents, guidelines, and records used in your review.
4. Respond in writing within the timeframe required by my policy and applicable law.

Please confirm receipt of this appeal. I can be reached at the contact information below.

Sincerely,

${ctx.senderName}
[YOUR ADDRESS / PHONE / EMAIL]

Enclosures: as listed above`,
  },
  "veteran-benefits": {
    "va-evidence-request": (v, ctx) => `${ctx.todayLong}

${v.provider_name || "[PROVIDER / FACILITY NAME]"}
${v.provider_address || "[PROVIDER ADDRESS]"}

Re: Request for Medical Records
Patient: ${ctx.senderName}
Date of Birth: ${v.patient_dob || "[DATE OF BIRTH]"}

To Whom It May Concern:

I am requesting copies of my medical records to support a claim for veterans' benefits with the Department of Veterans Affairs.

Please provide records for the following treatment period: ${v.treatment_period || "[TREATMENT PERIOD]"}

Records requested:
${v.records_wanted || "[DESCRIBE THE RECORDS — TREATMENT NOTES, IMAGING, TEST RESULTS, DIAGNOSES]"}

Please send the records to:
${v.return_address || "[YOUR MAILING ADDRESS OR SECURE DELIVERY METHOD]"}

If a signed authorization form is required, please send it to me and I will return it promptly. If any fee applies, please notify me of the amount before processing. Note that some states limit or waive fees for records supporting benefits claims.

Thank you for your assistance.

Sincerely,

${ctx.senderName}`,
  },
  "tenant-rights": {
    "tenant-repair-request": (v, ctx) => `${ctx.todayLong}

To: ${v.landlord_name || "[LANDLORD / PROPERTY MANAGER]"}
${v.landlord_address || "[LANDLORD MAILING ADDRESS]"}

Re: Formal Repair Request — ${v.unit_address || "[RENTAL ADDRESS / UNIT]"}

Dear ${v.landlord_name || "[LANDLORD NAME]"},

I am writing to formally request repairs at the rental unit listed above. The following issue(s) need attention:

${v.issue_description || "[DESCRIBE EACH PROBLEM — LOCATION, WHAT'S WRONG, AND HOW IT AFFECTS THE UNIT]"}

${v.first_reported ? `I previously reported this: ${v.first_reported}. This letter confirms that request in writing.` : "This letter serves as my formal written notice of these conditions."}

Please arrange for repairs within a reasonable time. Repair workers may access the unit: ${v.access_times || "[ACCESS AVAILABILITY]"} — with proper advance notice as required by the lease and state law.

Please confirm in writing when the repairs will be scheduled. I have documented the current conditions with dated photographs and will continue to keep records.

I value the tenancy and would like to resolve this cooperatively.

Sincerely,

${ctx.senderName}
${v.unit_address || "[YOUR ADDRESS]"}`,
  },
};

export function getLetterRenderer(slug: string, templateId: string): LetterRenderer | null {
  const forNavigator = (RENDERERS as Record<string, Record<string, LetterRenderer>>)[slug];
  return forNavigator?.[templateId] ?? null;
}

/** For tests: every [slug, templateId] that has a renderer. */
export function listLetterRenderers(): { slug: NavigatorSlug; templateId: string }[] {
  return (Object.keys(RENDERERS) as NavigatorSlug[]).flatMap((slug) =>
    Object.keys(RENDERERS[slug]).map((templateId) => ({ slug, templateId })),
  );
}
