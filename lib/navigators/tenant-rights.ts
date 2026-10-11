import type { NavigatorDef, PlanResult } from "@/lib/types";

const tenantRights: NavigatorDef = {
  slug: "tenant-rights",
  name: "Tenant Rights Navigator",
  shortName: "Tenant Rights",
  tagline: "Document rent and repair issues, and put requests in writing.",
  description:
    "Intake for rent and habitability issues, a repair request tracker, a formal notice/letter generator, a lease document checklist, and a dated timeline of every landlord communication.",
  icon: "home",
  accent: "199 89% 48%",
  launchStatus: "preview",
  problems: [
    "Repairs requested but never done",
    "Security deposit disputes",
    "Rent increase or lease term confusion",
    "Notices from the landlord (entry, lease violation, eviction threat)",
    "No paper trail of landlord communications",
  ],
  questions: [
    {
      id: "issue_type",
      label: "What's the main issue?",
      type: "select",
      required: true,
      options: [
        { value: "repairs", label: "Repairs / habitability problems" },
        { value: "deposit", label: "Security deposit dispute" },
        { value: "rent_increase", label: "Rent increase / lease terms" },
        { value: "eviction_notice", label: "Received an eviction or violation notice" },
        { value: "privacy", label: "Landlord entry / privacy issues" },
        { value: "other", label: "Something else" },
      ],
    },
    {
      id: "state",
      label: "Which state is the rental in?",
      type: "text",
      required: true,
      placeholder: "e.g. New York",
    },
    {
      id: "has_lease",
      label: "Do you have a written lease?",
      type: "boolean",
    },
    {
      id: "issue_start",
      label: "When did the issue start?",
      type: "date",
    },
    {
      id: "repair_severity",
      label: "How severe is the repair issue?",
      type: "select",
      showIf: { questionId: "issue_type", equals: "repairs" },
      options: [
        { value: "emergency", label: "Emergency — no heat/water, flooding, unsafe conditions" },
        { value: "major", label: "Major — affects daily living (appliances, leaks, pests)" },
        { value: "minor", label: "Minor — cosmetic or convenience" },
      ],
    },
    {
      id: "reported_before",
      label: "Have you already reported this to the landlord?",
      type: "select",
      options: [
        { value: "no", label: "Not yet" },
        { value: "verbal", label: "Yes — verbally / by text" },
        { value: "written", label: "Yes — in writing (letter or email)" },
      ],
    },
    {
      id: "rent_current",
      label: "Are you current on rent?",
      type: "boolean",
      help: "Being current strengthens your position in almost every dispute.",
    },
    {
      id: "notice_deadline",
      label: "If you received a notice, what deadline does it state?",
      type: "date",
      showIf: { questionId: "issue_type", equals: "eviction_notice" },
      help: "Eviction notices state a response or move-out date. Enter it exactly.",
    },
    {
      id: "evidence_on_hand",
      label: "What documentation do you have?",
      type: "multiselect",
      options: [
        { value: "lease", label: "Signed lease" },
        { value: "photos", label: "Photos / videos of the issue" },
        { value: "messages", label: "Texts or emails with the landlord" },
        { value: "rent_receipts", label: "Rent payment records" },
        { value: "notices", label: "Notices received" },
      ],
    },
    {
      id: "landlord_contact",
      label: "Landlord or property manager contact",
      type: "contact",
      help: "Used to address your written request or notice.",
    },
    {
      id: "situation_notes",
      label: "Describe the situation",
      type: "textarea",
      placeholder: "e.g. The bathroom ceiling has been leaking since March. I texted the property manager twice…",
    },
    {
      id: "evidence_upload",
      label: "Photos, notices, and key messages",
      type: "file",
      help: "Date-stamped photos are strong evidence — keep taking them.",
    },
  ],
  baseTasks: [
    { title: "Photograph and date-stamp everything", description: "Wide shots and close-ups of any issue, plus screenshots of relevant texts. Store copies outside your phone.", category: "Evidence", dueInDays: 2 },
    { title: "Locate and read your lease", description: "Find the clauses on repairs, notice, entry, and deposits. Highlight anything relevant to your issue.", category: "Documents", dueInDays: 3 },
    { title: "Start the communication timeline", description: "Log every landlord interaction — date, method, what was said — in the case timeline. Courts and mediators love timelines.", category: "Organize", dueInDays: 1 },
    { title: "Put your request in writing", description: "Verbal requests are hard to prove. Send the generated letter by a trackable method and keep a copy.", category: "Act", dueInDays: 5 },
    { title: "Look up your local tenant resources", description: "Many cities have free tenant hotlines, mediation programs, and legal aid — find yours before you need it.", category: "Support", dueInDays: 7 },
  ],
  baseDocuments: [
    { name: "Signed lease agreement", required: true },
    { name: "Rent payment records (12 months)", required: true },
    { name: "Photos/videos of the issue (date-stamped)", required: true },
    { name: "All written communications with landlord", required: true },
    { name: "Any notices received", required: false },
    { name: "Move-in inspection / condition report", required: false, description: "Critical for deposit disputes." },
  ],
  letterTemplates: [
    {
      id: "tenant-repair-request",
      name: "Tenant Repair Request Letter",
      description: "A formal, dated repair request that creates the written record most tenant protections require.",
      fields: [
        { id: "landlord_name", label: "Landlord / property manager", placeholder: "Ms. Rivera, Oakwood Property Management", fromAnswer: "landlord_contact" },
        { id: "landlord_address", label: "Landlord mailing address", multiline: true },
        { id: "unit_address", label: "Your rental address / unit", multiline: true },
        { id: "issue_description", label: "Describe the problem(s)", multiline: true, fromAnswer: "situation_notes" },
        { id: "first_reported", label: "When you first reported it (if before)", placeholder: "e.g. By text on March 12, 2026" },
        { id: "access_times", label: "When repair workers can access the unit", placeholder: "e.g. Weekdays after 4pm, or anytime with 24h notice" },
      ],
      render: (v, ctx) => `${ctx.todayLong}

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
  ],
  disclaimer:
    "BureauOS helps you document issues, organize evidence, and communicate in writing. It is not legal advice. Tenant protections vary widely by state and city — before withholding rent or taking legal steps, talk to local legal aid or a tenant hotline (often free).",
  buildPlan: (a): PlanResult => {
    const issue = (a.issue_type as string) || "other";
    const state = (a.state as string) || "your state";
    const severity = a.repair_severity as string | undefined;
    const reported = (a.reported_before as string) || "no";
    const rentCurrent = a.rent_current === true;
    const hasLease = a.has_lease === true;

    const plan: PlanResult = {
      situationSummary: "",
      priority: "medium",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: "tenant-repair-request",
      timelineEntries: [{ title: "Action plan generated", detail: "Tenant Rights Navigator produced an initial plan from your intake answers." }],
    };

    if (issue === "repairs") {
      plan.priority = severity === "emergency" ? "urgent" : severity === "major" ? "high" : "medium";
      plan.situationSummary = `You have ${severity === "emergency" ? "an emergency habitability issue" : severity === "major" ? "a major repair issue" : "a repair issue"} at your rental in ${state}${reported === "written" ? ", already reported in writing" : reported === "verbal" ? ", reported only verbally so far" : ", not yet reported"}. Tenant repair protections almost always require written notice first — this plan builds the paper trail and escalation path.`;
      plan.nextActions = [
        { title: severity === "emergency" ? "Report the emergency through every channel today" : "Send the formal written repair request", detail: severity === "emergency" ? "Call, text, AND send the written request today. For no-heat/no-water/unsafe conditions, also check whether your city code enforcement takes emergency habitability complaints." : reported === "written" ? "Send a follow-up letter referencing your earlier written request and setting a reasonable response date." : "Use the repair request generator. Written notice is what starts the legal clock in most states." },
        { title: "Document conditions thoroughly", detail: "Dated photos/video of each issue, plus any effects (damaged belongings, health impacts). Update the case timeline every time anything changes." },
        { title: "Learn your escalation options before you need them", detail: `If the landlord doesn't act in a reasonable time, ${state} may allow repair-and-deduct, code enforcement complaints, or other remedies — each has strict prerequisites. Get advice from local legal aid before using any of them.` },
      ];
      if (severity === "emergency") {
        plan.riskFlags.push({ label: "Emergency habitability", detail: "No heat, water, or unsafe conditions may violate housing codes right now. City code enforcement can inspect and order repairs independent of your landlord's cooperation.", severity: "critical" });
        plan.deadlines.push({ kind: "suggested", title: "Follow up if no landlord response", inDays: 2, note: "For emergencies, escalate to code enforcement fast if the landlord is silent." });
      } else {
        plan.deadlines.push({ kind: "suggested", title: "Follow up on repair request", inDays: 14, note: "A follow-up target, not a legal deadline: if there's no response or repair by then, send a follow-up and consider code enforcement." });
      }
      plan.riskFlags.push({ label: "Don't withhold rent without advice", detail: `Rent withholding is legal in some states only under strict conditions — done wrong it becomes grounds for eviction. Talk to ${state} legal aid first.`, severity: "warning" });
    } else if (issue === "deposit") {
      plan.priority = "medium";
      plan.situationSummary = `You have a security deposit dispute in ${state}. Deposit law is one of the most tenant-friendly areas: states set return deadlines and itemization requirements, and violations can mean multiple damages. The plan is to establish the timeline and demand what the statute requires — in writing.`;
      plan.nextActions = [
        { title: "Establish the deadline math", detail: `Find your move-out date and ${state}'s deposit return deadline (commonly 14–45 days). If it passed without a refund or itemized statement, the landlord may already be in violation.` },
        { title: "Assemble condition evidence", detail: "Move-in report, move-out photos, and receipts. The dispute is usually about condition — evidence wins it." },
        { title: "Send a written demand letter", detail: "Demand the deposit or a lawful itemized statement, cite the state deadline, and set a response date. Small claims court is the standard next step and is designed for exactly this." },
      ];
      plan.extraDocuments.push({ name: "Move-out photos / video walkthrough", required: true }, { name: "Forwarding address proof sent to landlord", required: false, description: "Many states start the return clock when you provide a forwarding address in writing." });
      plan.deadlines.push({ kind: "official_unavailable", key: "deposit-return", title: "Security deposit return deadline", note: `BureauOS has no verified rule for ${state}. Look up the exact deadline and compare it to your move-out date.` });
    } else if (issue === "eviction_notice") {
      plan.priority = "urgent";
      plan.situationSummary = `You received an eviction or lease-violation notice in ${state}. Notices have short, hard deadlines, and the single most important fact is this: an eviction notice is not an eviction — only a court can order you out, and tenants who respond on time have real options. Speed matters more than anything else here.`;
      plan.nextActions = [
        { title: "Contact legal aid today", detail: `Eviction defense is time-sensitive and ${state} legal aid organizations handle it daily, often free. Many cities also have right-to-counsel programs. Call before the notice deadline.` },
        { title: "Decode the notice", detail: "Identify the notice type (pay-or-quit, cure-or-quit, no-cause), the deadline, and whether it's technically valid (correct notice period, proper service, accurate amounts)." },
        { title: "Preserve every document and stay put", detail: "Keep the notice, envelope, lease, and payment records. Do not move out just because you got a notice — that can waive defenses. Respond to any court papers by their deadline, always." },
      ];
      if (typeof a.notice_deadline === "string" && a.notice_deadline) {
        plan.deadlines.push({ kind: "self_reported", title: "Deadline stated on the notice", date: a.notice_deadline, note: "The date you entered from your notice. Act before it — options narrow afterward." });
      } else {
        plan.deadlines.push({ kind: "official_unavailable", key: "notice-deadline", title: "Deadline stated on your notice", note: "Not entered yet. The deadline is printed on the notice — locate it today." });
      }
      plan.riskFlags.push(
        { label: "Court deadline risk", detail: "If this becomes a court case, missing the answer deadline usually means an automatic loss (default judgment). Court papers outrank everything else on your to-do list.", severity: "critical" },
        { label: "Don't sign anything under pressure", detail: "Agreements offered at the door or in hallways can waive rights. Have legal aid review anything before signing.", severity: "warning" },
      );
    } else if (issue === "rent_increase") {
      plan.priority = "medium";
      plan.situationSummary = `You're facing a rent increase or lease term dispute in ${state}. The questions that decide these: what does the lease say, what notice period does state/local law require, and is any rent regulation in force where you live. This plan answers all three.`;
      plan.nextActions = [
        { title: "Check the lease first", detail: "Mid-lease increases are usually invalid unless the lease allows them. For renewals, check the required notice period." },
        { title: "Verify notice requirements and local limits", detail: `${state} and your city may set minimum notice periods for increases (often 30–90 days) and some cities cap increase amounts. Check both.` },
        { title: "Respond in writing", detail: "Whether negotiating, accepting, or disputing — put your position in writing with dates. Negotiation works more often than tenants expect, especially with a good payment history." },
      ];
    } else if (issue === "privacy") {
      plan.priority = "medium";
      plan.situationSummary = `You're dealing with landlord entry or privacy issues in ${state}. Most states require advance notice (commonly 24–48 hours) for non-emergency entry. The remedy path runs through documentation and written objection.`;
      plan.nextActions = [
        { title: "Log every entry incident", detail: "Date, time, whether notice was given, what happened. Patterns matter more than single incidents." },
        { title: "Send a written notice-of-rights letter", detail: `State that you expect the notice period ${state} law requires for entries, and that you're documenting violations.` },
        { title: "Escalate if it continues", detail: "Repeated illegal entry can constitute harassment. Local tenant organizations and legal aid can advise on remedies." },
      ];
    } else {
      plan.situationSummary = `You have a tenancy issue in ${state}. Whatever the specifics, the same foundation wins: a written record, organized evidence, and knowing your local resources. This plan builds that foundation.`;
      plan.nextActions = [
        { title: "Write down the full story with dates", detail: "A dated narrative of what happened is the base for every letter, complaint, or consultation that follows." },
        { title: "Put your position in writing to the landlord", detail: "Written communication creates the record that verbal conversations never do." },
        { title: "Find your local tenant resources", detail: `Search for ${state} tenant hotline / legal aid — a 20-minute call can tell you exactly where you stand.` },
      ];
    }

    if (!hasLease) {
      plan.riskFlags.push({ label: "No written lease", detail: "You still have tenant rights — verbal tenancies are legal and protected in every state, usually as month-to-month. Gather rent payment proof to establish the tenancy.", severity: "info" });
      plan.extraTasks.push({ title: "Assemble proof of tenancy", description: "Rent receipts, bank transfers, mail at the address, utility bills — anything establishing you live there and pay rent.", category: "Evidence", dueInDays: 5 });
    }
    if (!rentCurrent && issue !== "eviction_notice") {
      plan.riskFlags.push({ label: "Rent not current", detail: "Unpaid rent weakens leverage in any dispute and can trigger a pay-or-quit notice. If possible, get current or negotiate a written payment plan.", severity: "warning" });
    }
    plan.extraTasks.push({ title: "Back up your evidence off-device", description: "Copy photos, messages, and documents to cloud storage or email them to yourself — phones get lost.", category: "Evidence", dueInDays: 3 });
    return plan;
  },
};

export default tenantRights;
