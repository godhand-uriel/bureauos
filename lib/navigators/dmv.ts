import type { NavigatorDef, PlanResult } from "@/lib/types";

const dmv: NavigatorDef = {
  slug: "dmv",
  name: "DMV Navigator",
  shortName: "DMV",
  tagline: "Untangle license, registration, and suspension problems.",
  description:
    "Work through license issues, registration problems, suspensions, and lost documents with a clear reinstatement checklist and a records request letter you can send today.",
  icon: "car",
  accent: "217 91% 60%",
  launchStatus: "preview",
  problems: [
    "Suspended or revoked license",
    "Expired or failed vehicle registration",
    "Lost license, title, or registration documents",
    "Unpaid tickets or fees blocking reinstatement",
    "Out-of-state transfer confusion",
  ],
  questions: [
    {
      id: "issue_type",
      label: "What kind of DMV issue are you dealing with?",
      type: "select",
      required: true,
      options: [
        { value: "suspension", label: "License suspension or revocation" },
        { value: "registration", label: "Vehicle registration problem" },
        { value: "lost_documents", label: "Lost license, title, or documents" },
        { value: "renewal", label: "Renewal trouble (license or registration)" },
        { value: "other", label: "Something else" },
      ],
    },
    {
      id: "suspension_reason",
      label: "Why was your license suspended?",
      type: "select",
      showIf: { questionId: "issue_type", equals: "suspension" },
      options: [
        { value: "unpaid_tickets", label: "Unpaid tickets or fines" },
        { value: "insurance_lapse", label: "Insurance lapse" },
        { value: "points", label: "Too many points / violations" },
        { value: "dui", label: "DUI / DWI related" },
        { value: "unknown", label: "I don't know" },
      ],
    },
    {
      id: "state",
      label: "Which state's DMV is this with?",
      type: "text",
      required: true,
      placeholder: "e.g. California",
    },
    {
      id: "notice_received",
      label: "Have you received a written notice from the DMV?",
      type: "boolean",
      help: "A letter, email, or notice explaining the issue or a deadline.",
    },
    {
      id: "notice_deadline",
      label: "Is there a deadline printed on the notice?",
      type: "date",
      showIf: { questionId: "notice_received", equals: true },
      help: "Enter the deadline exactly as printed. You'll verify it later.",
    },
    {
      id: "owes_fees",
      label: "Do you owe fees, fines, or reinstatement charges?",
      type: "boolean",
    },
    {
      id: "fee_amount",
      label: "Roughly how much do you owe (in dollars)?",
      type: "number",
      showIf: { questionId: "owes_fees", equals: true },
      placeholder: "e.g. 350",
    },
    {
      id: "needs_to_drive",
      label: "Do you need to drive for work or caregiving right now?",
      type: "boolean",
      help: "Some states offer hardship or restricted licenses.",
    },
    {
      id: "documents_on_hand",
      label: "Which documents do you currently have?",
      type: "multiselect",
      options: [
        { value: "id", label: "Government-issued photo ID" },
        { value: "proof_insurance", label: "Proof of insurance" },
        { value: "proof_address", label: "Proof of address" },
        { value: "title", label: "Vehicle title" },
        { value: "notice", label: "The DMV notice itself" },
      ],
    },
    {
      id: "dmv_contact",
      label: "DMV office or contact you've been dealing with (if any)",
      type: "contact",
      help: "Optional — helps prefill letters and track who you talked to.",
    },
    {
      id: "situation_notes",
      label: "Briefly describe what happened",
      type: "textarea",
      placeholder: "e.g. My registration renewal was rejected because of a smog check issue…",
    },
    {
      id: "notice_upload",
      label: "DMV notice or letter",
      type: "file",
      help: "Keep a copy handy — you'll attach it when you contact the DMV.",
    },
  ],
  baseTasks: [
    { title: "Locate your driver record", description: "Request your official driving record so you know exactly what the DMV has on file.", category: "Prepare", dueInDays: 5 },
    { title: "Confirm the exact issue with the DMV", description: "Call or visit your DMV and get the specific hold, code, or requirement in writing.", category: "Prepare", dueInDays: 7 },
    { title: "List every fee and requirement", description: "Write down each fee, class, form, or proof the DMV requires before reinstatement or renewal.", category: "Organize", dueInDays: 10 },
    { title: "Gather identity and residency documents", description: "Photo ID, proof of address, and proof of insurance are needed for most DMV transactions.", category: "Documents", dueInDays: 10 },
    { title: "Schedule your DMV appointment", description: "Book the earliest appointment — walk-in waits are long and some transactions are appointment-only.", category: "Act", dueInDays: 14 },
  ],
  baseDocuments: [
    { name: "Government-issued photo ID", required: true },
    { name: "Proof of address (utility bill, lease, bank statement)", required: true },
    { name: "Proof of insurance (SR-22 if required)", required: true, description: "If your suspension is insurance-related, ask your insurer about SR-22 filing." },
    { name: "DMV notice or correspondence", required: true },
    { name: "Official driving record", required: false, description: "Order online or by mail from your state DMV." },
    { name: "Payment receipts for fines/fees", required: false },
  ],
  letterTemplates: [
    {
      id: "dmv-records-request",
      name: "DMV Records Request Letter",
      description: "Request your driving record and details of any holds or suspension requirements in writing.",
      fields: [
        { id: "dmv_office", label: "DMV office name / address", placeholder: "Department of Motor Vehicles, Records Unit" },
        { id: "license_number", label: "Driver license number", placeholder: "D1234567" },
        { id: "dob", label: "Date of birth", placeholder: "January 1, 1990" },
        { id: "issue_summary", label: "Brief description of the issue", multiline: true, fromAnswer: "situation_notes" },
        { id: "return_address", label: "Your mailing address", multiline: true },
      ],
      render: (v, ctx) => `${ctx.todayLong}

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
  ],
  disclaimer:
    "BureauOS helps you organize your DMV situation and prepare next steps. It is not legal advice, and DMV rules vary by state — always verify requirements and deadlines directly with your state DMV.",
  buildPlan: (a): PlanResult => {
    const issue = a.issue_type as string;
    const suspReason = a.suspension_reason as string | undefined;
    const state = (a.state as string) || "your state";
    const needsToDrive = a.needs_to_drive === true;
    const owesFees = a.owes_fees === true;
    const hasNotice = a.notice_received === true;

    const plan: PlanResult = {
      situationSummary: "",
      priority: "medium",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: "dmv-records-request",
      timelineEntries: [],
    };

    if (issue === "suspension") {
      plan.priority = needsToDrive ? "urgent" : "high";
      plan.situationSummary = `You're dealing with a license suspension in ${state}${
        suspReason && suspReason !== "unknown"
          ? ` related to ${suspReason.replace(/_/g, " ")}`
          : ""
      }. The path back is usually: confirm the exact requirements, clear each one, then pay the reinstatement fee. ${
        needsToDrive
          ? "Because you need to drive for work or caregiving, ask about a hardship or restricted license immediately."
          : ""
      }`;
      plan.nextActions = [
        { title: "Get the suspension details in writing", detail: `Contact the ${state} DMV and request the specific reason codes, requirements, and reinstatement fee for your suspension.` },
        { title: "Clear the underlying requirement", detail: suspReason === "unpaid_tickets" ? "Pay or set up a payment plan for outstanding tickets — courts often lift DMV holds within days of payment." : suspReason === "insurance_lapse" ? "Reinstate insurance and ask your insurer to file proof (often an SR-22) with the DMV." : "Resolve the underlying issue the DMV identifies (fines, classes, insurance proof, or court requirements)." },
        { title: "Schedule reinstatement", detail: "Once requirements are cleared, book the earliest DMV appointment and bring every document on your checklist." },
      ];
      if (needsToDrive) {
        plan.extraTasks.push({ title: "Ask about a hardship / restricted license", description: `Many states allow limited driving for work. Ask the ${state} DMV what programs exist and how to apply.`, category: "Act", dueInDays: 3 });
        plan.riskFlags.push({ label: "Driving while suspended", detail: "Driving on a suspended license can add new penalties and extend the suspension. Avoid it until you're reinstated or have a restricted license.", severity: "critical" });
      }
      if (suspReason === "dui") {
        plan.riskFlags.push({ label: "Court-related suspension", detail: "DUI-related suspensions usually involve court requirements in addition to DMV steps. Confirm both tracks — completing one doesn't clear the other.", severity: "warning" });
      }
    } else if (issue === "registration") {
      plan.priority = "medium";
      plan.situationSummary = `You have a vehicle registration problem in ${state}. Most registration issues come down to a missing prerequisite — insurance proof, smog/inspection, unpaid fees, or a title issue. The plan is to identify which one is blocking you and clear it.`;
      plan.nextActions = [
        { title: "Identify the exact block", detail: "Check your renewal notice or DMV online account for the specific hold (inspection, insurance, fees, title)." },
        { title: "Clear the prerequisite", detail: "Complete the inspection, update insurance, or pay the fee that's blocking renewal." },
        { title: "Renew and keep proof", detail: "Renew online if possible and save the confirmation — keep the printed receipt in the vehicle until stickers arrive." },
      ];
      plan.extraDocuments.push({ name: "Smog / safety inspection certificate", required: false, description: "Only if your state requires it for renewal." });
      plan.riskFlags.push({ label: "Driving with expired registration", detail: "Expired registration can mean tickets or towing. Minimize driving until it's renewed.", severity: "warning" });
    } else if (issue === "lost_documents") {
      plan.priority = "medium";
      plan.situationSummary = `You need to replace lost DMV documents in ${state}. Replacements are routine — the work is gathering the identity proofs each replacement requires and submitting the right form.`;
      plan.nextActions = [
        { title: "List what needs replacing", detail: "License, title, and registration each have their own replacement form and fee. List exactly what's missing." },
        { title: "Gather identity documents", detail: "Most replacements need photo ID (or alternatives), proof of address, and a fee." },
        { title: "Submit replacement requests", detail: `Many replacements can be done online through the ${state} DMV. Duplicate titles sometimes require a notarized form.` },
      ];
      plan.extraTasks.push({ title: "Check for identity misuse", description: "If your license was lost with a wallet, consider a credit freeze and monitor for identity misuse.", category: "Protect", dueInDays: 3 });
    } else if (issue === "renewal") {
      plan.priority = "low";
      plan.situationSummary = `You're working through a renewal issue in ${state}. Renewals get stuck on expired documents, REAL ID requirements, or unpaid items — the plan is to find the blocker and book the right appointment type.`;
      plan.nextActions = [
        { title: "Check renewal eligibility online", detail: `Log into the ${state} DMV portal — it usually states exactly why online renewal is blocked.` },
        { title: "Prepare REAL ID documents if upgrading", detail: "REAL ID renewals need extra proofs: identity, two proofs of residency, and your Social Security number." },
        { title: "Book the correct appointment", detail: "Choose the specific renewal appointment type — the wrong type gets turned away." },
      ];
    } else {
      plan.priority = "medium";
      plan.situationSummary = `You're dealing with a DMV issue in ${state}. The universal first step is getting the DMV's version of your record in writing so you know exactly what they require — then working the requirements one at a time.`;
      plan.nextActions = [
        { title: "Request your record and account status", detail: "Use the generated records request letter or the DMV online portal to see exactly what's on file." },
        { title: "Write down every requirement", detail: "Turn the DMV's response into a simple checklist of fees, forms, and proofs." },
        { title: "Resolve items one at a time", detail: "Work the checklist and keep receipts and confirmation numbers for everything." },
      ];
    }

    if (owesFees) {
      const amt = typeof a.fee_amount === "number" ? `about $${a.fee_amount}` : "an unknown amount";
      plan.extraTasks.push({ title: "Confirm total owed and payment options", description: `You estimated ${amt}. Get the official itemized total — payment plans are often available for larger amounts.`, category: "Fees", dueInDays: 5 });
    }
    if (hasNotice && typeof a.notice_deadline === "string" && a.notice_deadline) {
      plan.deadlines.push({ kind: "self_reported", title: "Deadline printed on DMV notice", date: a.notice_deadline, note: "The date you entered from your notice. Verify it on the notice and respond before it." });
      plan.riskFlags.push({ label: "Notice deadline", detail: "Missing a printed DMV deadline can escalate fees or trigger suspension. Treat the notice date as hard until confirmed otherwise.", severity: "warning" });
    } else if (!hasNotice) {
      plan.extraTasks.push({ title: "Check for missed mail from the DMV", description: "Update your address with the DMV and check whether notices went to an old address.", category: "Prepare", dueInDays: 5 });
    }
    plan.deadlines.push({ kind: "suggested", title: "Verify reinstatement/renewal deadline with DMV", inDays: 7, note: "Call or check online — confirm any real deadline that applies to your case." });
    plan.timelineEntries.push({ title: "Action plan generated", detail: "DMV Navigator produced an initial plan from your intake answers." });
    return plan;
  },
};

export default dmv;
