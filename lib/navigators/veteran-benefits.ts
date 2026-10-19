import type { NavigatorDef, PlanResult } from "@/lib/types";

const veteranBenefits: NavigatorDef = {
  slug: "veteran-benefits",
  name: "Veteran Benefits Navigator",
  shortName: "Veteran Benefits",
  tagline: "Prepare a complete, well-documented VA benefits claim.",
  description:
    "Organize your VA benefits journey: intake for the benefits you're pursuing, a claim preparation checklist, evidence tracker, appointment and document tracker, and a benefit category organizer.",
  icon: "medal",
  accent: "262 83% 66%",
  launchStatus: "preview",
  problems: [
    "Not sure which VA benefits apply",
    "Disability claim evidence feels overwhelming",
    "C&P exams and appointments to track",
    "Missing service records",
    "Claim denied or rated lower than expected",
  ],
  questions: [
    {
      id: "benefit_categories",
      label: "Which benefits are you pursuing?",
      type: "multiselect",
      required: true,
      options: [
        { value: "disability", label: "Disability compensation" },
        { value: "healthcare", label: "VA health care enrollment" },
        { value: "education", label: "Education (GI Bill)" },
        { value: "home_loan", label: "Home loan certificate" },
        { value: "pension", label: "Pension" },
        { value: "other", label: "Other / not sure" },
      ],
    },
    {
      id: "claim_stage",
      label: "Where are you in the process?",
      type: "select",
      required: true,
      options: [
        { value: "exploring", label: "Exploring what I'm eligible for" },
        { value: "preparing", label: "Preparing to file a claim" },
        { value: "filed", label: "Claim filed, waiting on decision" },
        { value: "decided", label: "Received a decision I disagree with" },
      ],
    },
    {
      id: "service_period",
      label: "When did you serve?",
      type: "select",
      options: [
        { value: "post_911", label: "Post-9/11 (2001 or later)" },
        { value: "gulf_war", label: "Gulf War era (1990–2001)" },
        { value: "vietnam", label: "Vietnam era" },
        { value: "other", label: "Other period" },
      ],
    },
    {
      id: "has_dd214",
      label: "Do you have your DD-214 (or discharge papers)?",
      type: "boolean",
      help: "The foundational document for almost every VA benefit.",
    },
    {
      id: "conditions",
      label: "Conditions or issues you plan to claim (if disability)",
      type: "textarea",
      placeholder: "e.g. Tinnitus, lower back pain from carrying gear, knee injury from 2015 deployment…",
      showIf: { questionId: "claim_stage", equals: "preparing" },
    },
    {
      id: "receiving_treatment",
      label: "Are you currently receiving treatment (VA or private)?",
      type: "boolean",
    },
    {
      id: "has_vso",
      label: "Are you working with a VSO (Veterans Service Officer)?",
      type: "boolean",
      help: "VSOs help file claims for free and are worth using.",
    },
    {
      id: "evidence_on_hand",
      label: "What records do you already have?",
      type: "multiselect",
      options: [
        { value: "dd214", label: "DD-214" },
        { value: "service_medical", label: "Service treatment records" },
        { value: "private_medical", label: "Private medical records" },
        { value: "buddy_statements", label: "Buddy / lay statements" },
        { value: "prior_decisions", label: "Prior VA decision letters" },
      ],
    },
    {
      id: "decision_date",
      label: "Date on the VA decision letter",
      type: "date",
      showIf: { questionId: "claim_stage", equals: "decided" },
      help: "Review options are generally available for one year from this date.",
    },
    {
      id: "vso_contact",
      label: "Your VSO or representative",
      type: "contact",
      help: "Optional — track who is helping with the claim.",
    },
    {
      id: "situation_notes",
      label: "Anything else about your situation?",
      type: "textarea",
      placeholder: "e.g. I've moved states since filing; some records may be under a different name…",
    },
    {
      id: "records_upload",
      label: "Service and medical records",
      type: "file",
      help: "Keep originals safe; work from copies.",
    },
  ],
  baseTasks: [
    { title: "Secure your DD-214", description: "If missing, request it free from the National Archives (milrecs) — it unlocks nearly everything else.", category: "Documents", dueInDays: 7 },
    { title: "Connect with a VSO", description: "Accredited VSOs (DAV, VFW, American Legion, county offices) prepare and file claims at no cost.", category: "Support", dueInDays: 10 },
    { title: "Create your VA.gov account", description: "Verified VA.gov access lets you file, upload evidence, and track status online.", category: "Prepare", dueInDays: 5 },
    { title: "Build your evidence inventory", description: "List every record you have and every record you need, with where it lives.", category: "Evidence", dueInDays: 10 },
    { title: "Start a benefits journal", description: "Log every VA contact, appointment, and letter with dates — claims span months and memory fades.", category: "Organize", dueInDays: 3 },
  ],
  baseDocuments: [
    { name: "DD-214 / discharge documents", required: true },
    { name: "Service treatment records", required: true, description: "Request via the VA or National Archives if you don't have copies." },
    { name: "Private medical records for claimed conditions", required: false },
    { name: "Buddy / lay statements", required: false, description: "Statements from people who witnessed the injury/condition or its effects (VA Form 21-10210)." },
    { name: "Marriage/dependent documents (for dependent benefits)", required: false },
    { name: "Prior VA decision letters", required: false },
  ],
  letterTemplates: [
    {
      id: "va-evidence-request",
      name: "Veteran Benefits Evidence Request Letter",
      description: "Request treatment records from a provider or facility to support your VA claim.",
      fields: [
        { id: "provider_name", label: "Provider / facility name", placeholder: "Riverside Medical Group, Records Dept." },
        { id: "provider_address", label: "Provider address", multiline: true },
        { id: "patient_dob", label: "Your date of birth", placeholder: "March 5, 1988" },
        { id: "treatment_period", label: "Treatment period", placeholder: "e.g. June 2019 – present" },
        { id: "records_wanted", label: "Records requested", multiline: true, placeholder: "All treatment notes, imaging, and test results related to lower back condition" },
        { id: "return_address", label: "Where to send records", multiline: true },
      ],
    },
  ],
  disclaimer:
    "Building202 helps you organize records, appointments, and deadlines for your VA benefits journey. It is not legal advice and is not affiliated with the VA. For claim strategy, work with an accredited VSO, agent, or attorney — VSO help is free.",
  buildPlan: (a): PlanResult => {
    const categories = (a.benefit_categories as string[]) || [];
    const stage = (a.claim_stage as string) || "exploring";
    const hasDd214 = a.has_dd214 === true;
    const hasVso = a.has_vso === true;
    const inTreatment = a.receiving_treatment === true;
    const evidence = (a.evidence_on_hand as string[]) || [];

    const catLabels: Record<string, string> = {
      disability: "disability compensation",
      healthcare: "VA health care",
      education: "GI Bill education benefits",
      home_loan: "a VA home loan certificate",
      pension: "pension",
      other: "benefits eligibility",
    };
    const pursuing = categories.length
      ? categories.map((c) => catLabels[c] || c).join(", ")
      : "VA benefits";

    const plan: PlanResult = {
      situationSummary: "",
      priority: "medium",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: "va-evidence-request",
      timelineEntries: [{ title: "Action plan generated", detail: "Veteran Benefits Navigator produced an initial plan from your intake answers." }],
    };

    if (stage === "exploring") {
      plan.situationSummary = `You're exploring ${pursuing}. The fastest path to clarity: secure your DD-214, sit down with a free accredited VSO, and let them map your full eligibility — veterans routinely discover benefits they didn't know applied.`;
      plan.nextActions = [
        { title: hasDd214 ? "Make certified copies of your DD-214" : "Request your DD-214 from the National Archives", detail: hasDd214 ? "Keep the original safe; use copies for every application." : "Free at archives.gov (eVetRecs). Everything downstream needs it." },
        { title: "Book a VSO eligibility review", detail: "County veteran service offices and organizations like DAV/VFW review your record and identify every benefit you qualify for — free." },
        { title: "Create a verified VA.gov account", detail: "You'll use it to apply, upload evidence, and track everything online." },
      ];
    } else if (stage === "preparing") {
      plan.priority = "high";
      plan.situationSummary = `You're preparing to file for ${pursuing}. Well-prepared claims — complete evidence, clear condition list, current diagnoses — decide faster and more favorably. This plan builds the evidence file before you file, and flags the intent-to-file option that protects your effective date while you prepare.`;
      plan.nextActions = [
        { title: "Submit an Intent to File", detail: "An Intent to File (VA Form 21-0966 or via VA.gov) locks your effective date and gives you up to a year to assemble the full claim. Do this first — it can be worth months of back pay." },
        { title: "Complete the evidence file per condition", detail: "For each condition: current diagnosis, in-service event or exposure, and a link between them. Buddy statements can fill gaps in service records." },
        { title: hasVso ? "File through your VSO" : "Engage a VSO before filing", detail: hasVso ? "Review the complete package with your VSO and file. Keep copies of every page submitted." : "An accredited VSO will strengthen and file the claim free of charge — worth the short wait to engage one." },
      ];
      plan.deadlines.push({ kind: "official_unavailable", key: "itf-window", title: "Intent to File — completion window", note: "Not calculated: the window runs from the date VA receives your Intent to File, which Building202 does not have. Use the date on your VA confirmation and verify the window with VA or your VSO." });
      if (!inTreatment) {
        plan.riskFlags.push({ label: "No current treatment", detail: "Claims need current diagnoses. If you're not in treatment for a claimed condition, get seen — VA health care or a private provider — before or right after filing.", severity: "warning" });
        plan.extraTasks.push({ title: "Get current medical documentation", description: "Schedule an exam for each claimed condition so there's a recent diagnosis on record.", category: "Evidence", dueInDays: 21 });
      }
    } else if (stage === "filed") {
      plan.situationSummary = `Your claim for ${pursuing} is filed and pending. The work now: respond fast to every VA request, never miss a C&P exam, and keep building the record in case a review step is needed later.`;
      plan.nextActions = [
        { title: "Track status weekly on VA.gov", detail: "Check the claim status and your mail weekly. VA requests often have short response windows." },
        { title: "Treat C&P exams as mandatory", detail: "Missing a Compensation & Pension exam can sink a claim. Confirm attendance, arrive early, and describe your worst days honestly — not your best." },
        { title: "Keep treatment continuous", detail: "Ongoing treatment records strengthen both the pending claim and any later review." },
      ];
      plan.extraTasks.push({ title: "Log every VA letter in the timeline", description: "Date received, what it asks, response deadline, and what you sent back.", category: "Organize" });
      plan.riskFlags.push({ label: "Exam no-show risk", detail: "If you can't attend a scheduled C&P exam, reschedule before the date — a no-show can lead to a decision on incomplete evidence.", severity: "warning" });
    } else {
      plan.priority = "high";
      plan.situationSummary = `You received a VA decision on ${pursuing} you disagree with. You generally have one year from the decision date to choose a review lane: Supplemental Claim (new evidence), Higher-Level Review (same evidence, senior reviewer), or Board Appeal. Choosing the right lane matters — this plan gets you to that choice with help.`;
      plan.nextActions = [
        { title: "Calendar the one-year review deadline", detail: "Most decision reviews must be requested within one year of the decision letter date. Mark it and work well ahead of it." },
        { title: "Get the decision explained", detail: "Request your claims file (C-file) and have a VSO walk through exactly why the rating/denial came out as it did." },
        { title: "Pick the review lane with your VSO", detail: "New evidence available → Supplemental Claim. VA made an error on existing evidence → Higher-Level Review. Complex disputes → Board Appeal." },
      ];
      if (typeof a.decision_date === "string" && a.decision_date) {
        plan.deadlines.push({ kind: "official_unavailable", key: "decision-review", title: "Decision review deadline", note: `Not calculated: Building202 has no verified rule for this navigator yet. You entered a decision date of ${a.decision_date}; the review deadline is stated on the decision letter — verify it there or with your VSO.` });
      } else {
        plan.deadlines.push({ kind: "official_unavailable", key: "decision-review", title: "Decision review deadline", note: "Not established: find the date on your decision letter. The review deadline is stated there." });
      }
      plan.riskFlags.push({ label: "Review window", detail: "Missing the one-year window doesn't end everything (Supplemental Claims can reopen later) but usually costs the earlier effective date — real money.", severity: "critical" });
      plan.extraDocuments.push({ name: "VA decision letter (all pages)", required: true }, { name: "C-file (claims file) request", required: false, description: "Request via VA.gov or FOIA — shows exactly what the rater saw." });
    }

    if (!hasDd214) {
      plan.extraTasks.unshift({ title: "Request DD-214 from National Archives", description: "Free via eVetRecs at archives.gov. Standard requests take a few weeks — start now.", category: "Documents", dueInDays: 3 });
      plan.riskFlags.push({ label: "Missing DD-214", detail: "Nearly every VA benefit requires discharge documentation. This is the critical path — request it immediately.", severity: "warning" });
    }
    if (!hasVso) {
      plan.extraTasks.push({ title: "Find an accredited VSO", description: "Use the VA's accreditation search or your county veteran service office. Their help is free.", category: "Support", dueInDays: 7 });
    }
    if (!evidence.includes("buddy_statements") && (stage === "preparing" || stage === "decided") && categories.includes("disability")) {
      plan.extraTasks.push({ title: "Collect buddy statements", description: "Ask people who witnessed the in-service event or see the condition's effects to write statements (VA Form 21-10210).", category: "Evidence", dueInDays: 21 });
    }
    if (categories.includes("education")) {
      plan.extraTasks.push({ title: "Apply for GI Bill Certificate of Eligibility", description: "Apply on VA.gov; your COE tells schools exactly what you're entitled to.", category: "Education", dueInDays: 14 });
    }
    if (categories.includes("home_loan")) {
      plan.extraTasks.push({ title: "Request VA home loan COE", description: "Available instantly for many veterans through VA.gov or a lender.", category: "Housing", dueInDays: 14 });
    }
    if (categories.includes("healthcare")) {
      plan.extraTasks.push({ title: "Apply for VA health care enrollment", description: "Apply online (10-10EZ). Enrollment also creates treatment records that support disability claims.", category: "Healthcare", dueInDays: 10 });
    }
    return plan;
  },
};

export default veteranBenefits;
