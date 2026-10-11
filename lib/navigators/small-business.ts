import type { NavigatorDef, PlanResult } from "@/lib/types";

const smallBusiness: NavigatorDef = {
  slug: "small-business",
  name: "Small Business Compliance Navigator",
  shortName: "Small Business",
  tagline: "Stay formed, licensed, registered, and filed — on time.",
  description:
    "A compliance command center for small business owners: formation checklist, licenses and permits, tax registrations, annual filing reminders, and a simple task board so nothing lapses.",
  icon: "store",
  accent: "160 84% 39%",
  launchStatus: "preview",
  problems: [
    "Not sure which licenses and permits apply",
    "Missed or upcoming annual report filings",
    "Tax registrations (EIN, sales tax, payroll) confusion",
    "Formation steps half-finished",
    "No system for recurring compliance deadlines",
  ],
  questions: [
    {
      id: "business_stage",
      label: "Where is the business today?",
      type: "select",
      required: true,
      options: [
        { value: "idea", label: "Still an idea — not formed yet" },
        { value: "forming", label: "Mid-formation (paperwork in progress)" },
        { value: "operating", label: "Formed and operating" },
        { value: "behind", label: "Operating but behind on filings" },
      ],
    },
    {
      id: "entity_type",
      label: "What entity type do you have (or plan)?",
      type: "select",
      options: [
        { value: "sole_prop", label: "Sole proprietorship" },
        { value: "llc", label: "LLC" },
        { value: "corp", label: "Corporation (C or S)" },
        { value: "partnership", label: "Partnership" },
        { value: "unsure", label: "Not sure yet" },
      ],
    },
    {
      id: "state",
      label: "Which state is (or will be) the business registered in?",
      type: "text",
      required: true,
      placeholder: "e.g. Florida",
    },
    {
      id: "business_name",
      label: "Business name",
      type: "text",
      placeholder: "e.g. Riverside Coffee LLC",
    },
    { id: "has_ein", label: "Do you have an EIN (federal tax ID)?", type: "boolean" },
    {
      id: "has_employees",
      label: "Do you have employees (or plan to hire soon)?",
      type: "boolean",
      help: "Triggers payroll tax registration and workers' comp requirements.",
    },
    {
      id: "sells_taxable",
      label: "Do you sell taxable goods or services?",
      type: "boolean",
      help: "Most physical products and some services require sales tax collection.",
    },
    {
      id: "licenses_held",
      label: "Which registrations do you already have?",
      type: "multiselect",
      options: [
        { value: "formation", label: "State formation documents" },
        { value: "ein", label: "EIN confirmation letter" },
        { value: "local_license", label: "City/county business license" },
        { value: "sales_permit", label: "Sales tax permit" },
        { value: "industry", label: "Industry-specific license" },
      ],
    },
    {
      id: "annual_report_due",
      label: "Do you know your next annual report / franchise tax due date?",
      type: "date",
      help: "Leave blank if unsure — the plan will include finding it.",
    },
    {
      id: "registered_agent",
      label: "Registered agent or state filing contact",
      type: "contact",
      help: "Optional — the person or service receiving official state mail.",
    },
    {
      id: "situation_notes",
      label: "What's the biggest compliance worry right now?",
      type: "textarea",
      placeholder: "e.g. I got a letter saying my LLC is not in good standing…",
    },
    {
      id: "formation_docs",
      label: "Formation documents",
      type: "file",
      help: "Articles of organization/incorporation, operating agreement, EIN letter.",
    },
  ],
  baseTasks: [
    { title: "Build your compliance calendar", description: "One list of every recurring obligation: annual report, franchise tax, license renewals, sales tax filings, payroll deposits.", category: "Organize", dueInDays: 7 },
    { title: "Verify good standing with the state", description: "Search your state's business registry — it shows status, missed filings, and your registered agent on file.", category: "Verify", dueInDays: 5 },
    { title: "Centralize formation documents", description: "Articles, operating agreement, EIN letter, and licenses in one place (physical + digital copy).", category: "Documents", dueInDays: 10 },
    { title: "Confirm city/county license requirements", description: "Local business licenses are the most commonly missed registration. Call or check your city and county sites.", category: "Verify", dueInDays: 10 },
    { title: "Separate business finances", description: "A dedicated business bank account keeps liability protection intact and makes tax time sane.", category: "Finance", dueInDays: 14 },
  ],
  baseDocuments: [
    { name: "Formation documents (articles of organization/incorporation)", required: true },
    { name: "EIN confirmation letter (IRS CP 575)", required: true },
    { name: "Operating agreement / bylaws", required: false },
    { name: "City/county business license", required: false },
    { name: "Sales tax permit", required: false },
    { name: "Industry-specific licenses or permits", required: false },
    { name: "Most recent annual report filing confirmation", required: false },
  ],
  letterTemplates: [
    {
      id: "compliance-memo",
      name: "Compliance Reminder / Internal Memo",
      description: "A dated internal memo documenting an upcoming obligation, owner, and plan — useful for partners, bookkeepers, or your own records.",
      fields: [
        { id: "business_name", label: "Business name", fromAnswer: "business_name" },
        { id: "obligation", label: "Obligation / filing", placeholder: "e.g. State annual report + franchise tax" },
        { id: "due_date", label: "Due date", placeholder: "e.g. May 1, 2027" },
        { id: "owner", label: "Who is responsible", placeholder: "e.g. Jordan (owner), CPA files it" },
        { id: "details", label: "Details / steps", multiline: true, placeholder: "Filing portal, fee amount, documents needed…" },
      ],
      render: (v, ctx) => `INTERNAL COMPLIANCE MEMO

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
  ],
  disclaimer:
    "BureauOS helps you organize compliance obligations and deadlines. It is not legal, tax, or accounting advice. Requirements vary by state, county, city, and industry — verify each obligation with the relevant agency or a professional.",
  buildPlan: (a): PlanResult => {
    const stage = a.business_stage as string;
    const entity = (a.entity_type as string) || "unsure";
    const state = (a.state as string) || "your state";
    const name = (a.business_name as string) || "your business";
    const hasEin = a.has_ein === true;
    const hasEmployees = a.has_employees === true;
    const sellsTaxable = a.sells_taxable === true;
    const held = (a.licenses_held as string[]) || [];

    const plan: PlanResult = {
      situationSummary: "",
      priority: "medium",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: "compliance-memo",
      timelineEntries: [{ title: "Action plan generated", detail: "Small Business Compliance Navigator produced an initial plan from your intake answers." }],
    };

    if (stage === "idea" || stage === "forming") {
      plan.priority = "medium";
      plan.situationSummary = `You're ${stage === "idea" ? "getting ready to form" : "mid-way through forming"} ${name} in ${state}. The formation sequence matters: entity filing first, then EIN, then bank account, then licenses. Doing them out of order causes rework.`;
      plan.nextActions = [
        { title: stage === "idea" ? "Choose and file your entity" : "Finish the state formation filing", detail: entity === "unsure" ? `Most small businesses choose an LLC for liability protection with simple taxes. File articles with the ${state} Secretary of State once decided.` : `Complete the ${entity === "llc" ? "LLC articles of organization" : entity === "corp" ? "articles of incorporation" : "registration"} with the ${state} Secretary of State.` },
        { title: "Get your EIN (free, 10 minutes)", detail: "Apply directly at irs.gov — it's free. Skip third-party sites that charge for it. You need the EIN for banking, hiring, and most registrations." },
        { title: "Map required licenses before opening", detail: `Check three layers: ${state} state licenses, county requirements, and city business license. Industry-specific permits (food, health, contracting) come on top.` },
      ];
      plan.extraTasks.push(
        { title: "Check business name availability", description: `Search the ${state} registry and USPTO trademark database before printing anything.`, category: "Formation", dueInDays: 3 },
        { title: "Draft an operating agreement", description: "Even single-member LLCs benefit — banks ask for it and it reinforces liability separation.", category: "Formation", dueInDays: 21 },
      );
    } else if (stage === "behind") {
      plan.priority = "high";
      plan.situationSummary = `${name} is operating in ${state} but behind on filings. The good news: states want you back in good standing and reinstatement is usually a fee-plus-paperwork problem, not a shutdown. The plan is to find every lapsed item, cure the state filing first, then work outward.`;
      plan.nextActions = [
        { title: "Pull your official standing report", detail: `Search the ${state} business registry today. It lists your status (active, delinquent, dissolved) and exactly which filings are missing.` },
        { title: "File the overdue annual report / franchise tax", detail: "Late fees grow and administrative dissolution follows extended delinquency. File the most overdue item first, keep the confirmation." },
        { title: "Audit licenses and tax accounts for lapses", detail: "Check local business license, sales tax account, and payroll accounts for missed renewals or returns — silence from an agency doesn't mean compliance." },
      ];
      plan.riskFlags.push(
        { label: "Administrative dissolution risk", detail: "Prolonged delinquency can lead the state to dissolve the entity, exposing you to personal liability for business obligations.", severity: "critical" },
        { label: "Accruing penalties", detail: "Late filing fees and interest compound. Filing sooner is nearly always cheaper than a perfect filing later.", severity: "warning" },
      );
      plan.deadlines.push({ kind: "suggested", title: "File overdue state report", inDays: 14, note: "Self-imposed target — verify actual penalty schedule with the state." });
    } else {
      plan.priority = "low";
      plan.situationSummary = `${name} is formed and operating in ${state}. The job now is defense: a compliance calendar that catches every recurring obligation before it's late, and a document file that proves compliance if anyone asks.`;
      plan.nextActions = [
        { title: "Verify good standing and agent info", detail: `Confirm your status on the ${state} registry and that your registered agent address is current — missed agent mail is how businesses discover problems late.` },
        { title: "Build the 12-month compliance calendar", detail: "Annual report, franchise tax, license renewals, sales tax filing dates, and payroll deposit schedule — every date in one place with 30-day reminders." },
        { title: "Document the current compliance state", detail: "Use the internal memo generator to record each upcoming obligation, owner, and due date." },
      ];
    }

    if (!hasEin && stage !== "idea") {
      plan.extraTasks.push({ title: "Apply for an EIN at irs.gov", description: "Free and immediate online. Required for employees, business banking, and most registrations.", category: "Tax", dueInDays: 5 });
      plan.riskFlags.push({ label: "Missing EIN", detail: "Operating without an EIN forces use of your SSN on business documents — a privacy and identity risk.", severity: "warning" });
    }
    if (hasEmployees) {
      plan.extraTasks.push(
        { title: "Confirm payroll tax registrations", description: `Federal (EFTPS) plus ${state} withholding and unemployment insurance accounts.`, category: "Tax", dueInDays: 10 },
        { title: "Verify workers' compensation coverage", description: "Required in nearly every state once you have employees. Penalties for lapses are steep.", category: "Insurance", dueInDays: 10 },
      );
      plan.riskFlags.push({ label: "Employer obligations active", detail: "Payroll tax deposits and workers' comp are strict-liability areas — missed deposits carry personal penalties for owners.", severity: "warning" });
    }
    if (sellsTaxable && !held.includes("sales_permit")) {
      plan.extraTasks.push({ title: "Register for a sales tax permit", description: `Register with the ${state} revenue department before collecting sales tax. Selling taxable goods without a permit can incur penalties.`, category: "Tax", dueInDays: 7 });
      plan.riskFlags.push({ label: "Uncollected sales tax", detail: "Sales tax liability accrues whether or not you collect it from customers. Register and start collecting promptly.", severity: "critical" });
    }
    if (!held.includes("local_license") && stage !== "idea") {
      plan.extraTasks.push({ title: "Check city and county license requirements", description: "Local business licenses are the most commonly missed registration.", category: "Licenses", dueInDays: 10 });
    }

    if (typeof a.annual_report_due === "string" && a.annual_report_due) {
      plan.deadlines.push({ kind: "self_reported", title: "Annual report / franchise tax due", date: a.annual_report_due, note: `The date you entered. Verify with the ${state} Secretary of State.` });
    } else {
      plan.extraTasks.push({ title: "Find your annual report due date", description: `Look up ${name} on the ${state} registry — the due date is usually tied to your formation anniversary or a fixed statewide date.`, category: "Verify", dueInDays: 5 });
    }
    plan.deadlines.push({ kind: "suggested", title: "Compliance calendar review", inDays: 30, note: "Recurring monthly check: anything due in the next 60 days?" });
    return plan;
  },
};

export default smallBusiness;
