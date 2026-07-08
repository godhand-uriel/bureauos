import type { NavigatorDef, PlanResult } from "@/lib/types";
import { daysUntil } from "@/lib/utils";

const insuranceDenial: NavigatorDef = {
  slug: "insurance-denial",
  name: "Insurance Denial Navigator",
  shortName: "Insurance Denial",
  tagline: "Turn a claim denial into an organized, on-time appeal.",
  description:
    "Capture the denial details, track the stated reasons, build your evidence file, watch the appeal deadline, and generate a structured appeal letter — health, auto, home, or disability claims.",
  icon: "shield",
  accent: "0 84% 60%",
  problems: [
    "Claim denied and the letter is confusing",
    "Appeal deadline approaching",
    "Not sure what evidence an appeal needs",
    "Multiple denials / partial payments to track",
    "Insurer not responding to calls",
  ],
  questions: [
    {
      id: "insurance_type",
      label: "What type of insurance claim was denied?",
      type: "select",
      required: true,
      options: [
        { value: "health", label: "Health / medical" },
        { value: "auto", label: "Auto" },
        { value: "home", label: "Homeowners / renters" },
        { value: "disability", label: "Disability" },
        { value: "life", label: "Life" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "denial_date",
      label: "What date is on the denial letter?",
      type: "date",
      required: true,
      help: "Appeal windows are measured from this date.",
    },
    {
      id: "denial_reason",
      label: "What reason did the insurer give?",
      type: "select",
      required: true,
      options: [
        { value: "not_medically_necessary", label: "Not medically necessary" },
        { value: "not_covered", label: "Service/item not covered" },
        { value: "out_of_network", label: "Out of network" },
        { value: "missing_info", label: "Missing information / paperwork" },
        { value: "pre_auth", label: "No prior authorization" },
        { value: "late_filing", label: "Claim filed late" },
        { value: "other", label: "Other / unclear" },
      ],
    },
    {
      id: "claim_amount",
      label: "Approximate amount at stake (in dollars)?",
      type: "number",
      placeholder: "e.g. 4200",
    },
    {
      id: "appeal_deadline_known",
      label: "Does the denial letter state an appeal deadline?",
      type: "boolean",
    },
    {
      id: "appeal_deadline",
      label: "What is the stated appeal deadline?",
      type: "date",
      showIf: { questionId: "appeal_deadline_known", equals: true },
    },
    {
      id: "urgent_care",
      label: "Is this about care or repairs you urgently need right now?",
      type: "boolean",
      help: "Health plans must offer expedited appeals when delays endanger health.",
    },
    {
      id: "already_appealed",
      label: "Have you already filed an internal appeal?",
      type: "boolean",
    },
    {
      id: "evidence_on_hand",
      label: "What do you already have?",
      type: "multiselect",
      options: [
        { value: "denial_letter", label: "The denial letter (EOB)" },
        { value: "policy", label: "Policy / benefits booklet" },
        { value: "records", label: "Medical records / repair estimates" },
        { value: "provider_letter", label: "Doctor or expert support letter" },
        { value: "call_log", label: "Notes from calls with the insurer" },
      ],
    },
    {
      id: "insurer_contact",
      label: "Insurer appeals contact (from the denial letter)",
      type: "contact",
      help: "The appeals address/department listed on the letter.",
    },
    {
      id: "situation_notes",
      label: "Describe the claim and why you believe it should be covered",
      type: "textarea",
      placeholder: "e.g. My doctor ordered an MRI after 6 weeks of failed physical therapy…",
    },
    {
      id: "denial_letter_file",
      label: "Denial letter / EOB",
      type: "file",
      help: "The single most important document in your appeal file.",
    },
  ],
  baseTasks: [
    { title: "Read the denial letter line by line", description: "Find the exact denial code/reason, the appeal deadline, and where appeals must be sent. Highlight all three.", category: "Prepare", dueInDays: 2 },
    { title: "Request the full claim file", description: "You're entitled to the documents the insurer used to decide — request them in writing.", category: "Evidence", dueInDays: 5 },
    { title: "Pull the exact policy language", description: "Find the section the insurer relies on. Appeals win by showing the policy language actually covers your claim.", category: "Evidence", dueInDays: 5 },
    { title: "Start a contact log", description: "Every call: date, time, name, reference number, what was said. This log matters if you escalate to regulators.", category: "Organize", dueInDays: 1 },
    { title: "Draft and send the appeal", description: "Use the appeal letter generator, attach evidence, send with delivery tracking.", category: "Act", dueInDays: 14 },
  ],
  baseDocuments: [
    { name: "Denial letter / Explanation of Benefits (EOB)", required: true },
    { name: "Full insurance policy or benefits booklet", required: true },
    { name: "Original claim submission", required: true },
    { name: "Supporting records (medical records, estimates, photos)", required: true },
    { name: "Provider or expert support letter", required: false, description: "A treating doctor's letter of medical necessity is often the strongest single item in a health appeal." },
    { name: "Contact log of all insurer communications", required: false },
  ],
  letterTemplates: [
    {
      id: "insurance-appeal",
      name: "Insurance Appeal Request Letter",
      description: "A structured formal appeal: claim details, denial reason, your argument, evidence list, and a clear request.",
      fields: [
        { id: "insurer_name", label: "Insurance company / appeals department", placeholder: "Appeals Department, Acme Insurance", fromAnswer: "insurer_contact" },
        { id: "insurer_address", label: "Appeals mailing address", multiline: true },
        { id: "policy_number", label: "Policy number", placeholder: "POL-123456" },
        { id: "claim_number", label: "Claim number", placeholder: "CLM-789012" },
        { id: "denial_date", label: "Date on denial letter", fromAnswer: "denial_date" },
        { id: "denial_reason", label: "Stated denial reason (quote the letter)", multiline: true },
        { id: "argument", label: "Why the denial is wrong", multiline: true, fromAnswer: "situation_notes", placeholder: "Reference policy language, medical necessity, correct facts…" },
        { id: "evidence_list", label: "Evidence enclosed (one per line)", multiline: true, placeholder: "Denial letter copy\nLetter from Dr. Smith\nMedical records 3/2–4/15" },
      ],
      render: (v, ctx) => `${ctx.todayLong}

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
  ],
  disclaimer:
    "BureauOS helps you organize your denial, evidence, and deadlines. It is not legal advice and cannot guarantee an appeal outcome. Appeal rights and deadlines vary by policy and state — verify them on your denial letter and policy, and consider your state insurance department's free consumer help line.",
  buildPlan: (a): PlanResult => {
    const type = (a.insurance_type as string) || "other";
    const reason = (a.denial_reason as string) || "other";
    const urgent = a.urgent_care === true;
    const alreadyAppealed = a.already_appealed === true;
    const amount = typeof a.claim_amount === "number" ? a.claim_amount : null;
    const deadlineKnown = a.appeal_deadline_known === true;

    const reasonLabels: Record<string, string> = {
      not_medically_necessary: "“not medically necessary”",
      not_covered: "the service or item “not being covered”",
      out_of_network: "the provider being out of network",
      missing_info: "missing information",
      pre_auth: "lack of prior authorization",
      late_filing: "late filing",
      other: "a reason that isn't fully clear",
    };

    const plan: PlanResult = {
      situationSummary: `Your ${type} insurance claim${amount ? ` (about $${amount.toLocaleString()})` : ""} was denied citing ${reasonLabels[reason]}. ${
        alreadyAppealed
          ? "Since the internal appeal was already used, the next moves are external review and state regulator escalation."
          : "Denials are frequently reversed on appeal when the response is organized, on time, and evidence-backed — that's exactly what this plan builds."
      }${urgent ? " Because care/repairs are urgently needed, pursue the expedited track in parallel." : ""}`,
      priority: urgent ? "urgent" : "high",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: "insurance-appeal",
      timelineEntries: [{ title: "Action plan generated", detail: "Insurance Denial Navigator produced an initial plan from your intake answers." }],
    };

    if (alreadyAppealed) {
      plan.nextActions = [
        { title: "Request external review", detail: type === "health" ? "After a final internal denial, you generally have the right to an independent external review — the request window is often 4 months from the final denial. The process is on your denial letter." : "Ask the insurer in writing for their final position, then check escalation options for your policy type." },
        { title: "File a complaint with your state insurance department", detail: "State insurance regulators take consumer complaints seriously and insurers respond to them. It's free and can run in parallel with external review." },
        { title: "Assemble the complete record", detail: "Every letter, denial, appeal, and call note in chronological order — external reviewers decide on the written record." },
      ];
      plan.deadlines.push({ title: "External review request window", inDays: 60, note: "Estimate — the real window is on your final denial letter. Verify it now." });
    } else {
      plan.nextActions = [
        { title: "Pin down the appeal deadline", detail: deadlineKnown ? "You have the stated deadline — put every step on a schedule that finishes at least a week before it." : "Read the denial letter and your policy for the appeal window (often 180 days for health plans, shorter for others). If it's not stated, call and get it with a reference number." },
        {
          title: "Build the counter-evidence for this specific reason",
          detail:
            reason === "not_medically_necessary"
              ? "Ask your treating doctor for a letter of medical necessity that addresses the insurer's criteria directly — this is the highest-value item you can add."
              : reason === "missing_info"
                ? "This is often the easiest reversal: identify exactly what was missing, supply it completely, and ask for reprocessing."
                : reason === "pre_auth"
                  ? "Gather proof of any authorization attempts and ask your provider to file a retroactive authorization request; note any emergency circumstances."
                  : reason === "out_of_network"
                    ? "Check for exceptions: emergencies, no in-network provider available, or referrals. Surprise-billing protections may also apply."
                    : reason === "late_filing"
                      ? "Collect proof of when the claim was actually submitted, and document any good cause for delay (hospitalization, insurer error)."
                      : "Get the specific policy provision behind the denial in writing, then gather documents showing your claim meets the policy terms.",
        },
        { title: "Send a written appeal with tracking", detail: "Use the appeal letter generator, enclose your evidence list, and send it by a method with delivery confirmation. Keep a complete copy." },
      ];
    }

    if (deadlineKnown && typeof a.appeal_deadline === "string" && a.appeal_deadline) {
      plan.deadlines.push({ title: "Appeal deadline (from denial letter)", inDays: daysUntil(a.appeal_deadline), note: `You entered ${a.appeal_deadline}. Confirm against the letter and finish the appeal at least 7 days before.` });
    } else if (!alreadyAppealed) {
      plan.deadlines.push({ title: "Confirm the appeal deadline", inDays: 5, note: "Find it on the letter/policy or get it from the insurer in writing." });
      plan.riskFlags.push({ label: "Unknown appeal deadline", detail: "Appeal windows are strict and some are short. Until confirmed, act as if the deadline is 30 days from the denial date.", severity: "critical" });
    }

    if (urgent) {
      plan.extraTasks.push({ title: "Request an expedited appeal", description: "For urgent health situations, insurers must offer fast-track appeals (typically 72 hours). Ask your doctor to certify urgency.", category: "Act", dueInDays: 1 });
      plan.riskFlags.push({ label: "Urgent care at stake", detail: "Don't let the standard appeal clock delay urgent care — expedited appeals and simultaneous external review exist for exactly this situation.", severity: "critical" });
    }
    if (amount && amount >= 10000) {
      plan.riskFlags.push({ label: "High-value claim", detail: `With roughly $${amount.toLocaleString()} at stake, a consultation with an attorney or public adjuster (for property claims) may pay for itself. Many work on contingency.`, severity: "info" });
    }
    plan.extraTasks.push({ title: "File notes after every insurer contact", description: "Date, time, representative name, reference number, and what was said — in the case timeline.", category: "Organize" });
    return plan;
  },
};

export default insuranceDenial;
