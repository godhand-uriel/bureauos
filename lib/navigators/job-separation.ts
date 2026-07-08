import type { NavigatorDef, PlanResult } from "@/lib/types";

const jobSeparation: NavigatorDef = {
  slug: "job-separation",
  name: "Job Separation Navigator",
  shortName: "Job Separation",
  tagline: "Protect your income and benefits after leaving a job.",
  description:
    "Whether you were fired, laid off, quit, or your contract ended — get an unemployment prep plan, final paycheck checklist, COBRA/benefits checklist, and an organized record of your employment documents.",
  icon: "briefcase",
  accent: "38 92% 50%",
  problems: [
    "Fired or laid off and unsure what to do first",
    "Final paycheck missing or incomplete",
    "Unemployment application preparation",
    "Health insurance / COBRA decisions on a deadline",
    "Scattered employment documents and agreements",
  ],
  questions: [
    {
      id: "separation_type",
      label: "How did the job end?",
      type: "select",
      required: true,
      options: [
        { value: "laid_off", label: "Laid off / position eliminated" },
        { value: "fired", label: "Fired / terminated" },
        { value: "quit", label: "I quit" },
        { value: "contract_ended", label: "Contract or seasonal work ended" },
      ],
    },
    {
      id: "last_day",
      label: "What was your last day of work?",
      type: "date",
      required: true,
    },
    {
      id: "state",
      label: "Which state did you work in?",
      type: "text",
      required: true,
      placeholder: "e.g. Texas",
    },
    {
      id: "received_final_pay",
      label: "Have you received your final paycheck?",
      type: "boolean",
      help: "Including unused PTO payout if your state or employer policy requires it.",
    },
    {
      id: "had_health_insurance",
      label: "Did you have health insurance through this employer?",
      type: "boolean",
    },
    {
      id: "severance_offered",
      label: "Were you offered a severance agreement?",
      type: "boolean",
    },
    {
      id: "filed_unemployment",
      label: "Have you already filed for unemployment?",
      type: "select",
      options: [
        { value: "no", label: "Not yet" },
        { value: "started", label: "Started but not finished" },
        { value: "filed", label: "Filed and waiting" },
        { value: "denied", label: "Filed and was denied" },
      ],
    },
    {
      id: "documents_on_hand",
      label: "Which documents do you have?",
      type: "multiselect",
      options: [
        { value: "offer_letter", label: "Offer letter / employment agreement" },
        { value: "paystubs", label: "Recent pay stubs" },
        { value: "termination_letter", label: "Termination / layoff letter" },
        { value: "handbook", label: "Employee handbook" },
        { value: "benefits_docs", label: "Benefits / insurance documents" },
      ],
    },
    {
      id: "hr_contact",
      label: "HR or manager contact for follow-ups",
      type: "contact",
      help: "Optional — used to prefill your follow-up letter.",
    },
    {
      id: "situation_notes",
      label: "Anything else about how the separation happened?",
      type: "textarea",
      placeholder: "e.g. I was told it was a restructuring, but…",
    },
    {
      id: "termination_docs",
      label: "Termination or layoff paperwork",
      type: "file",
      help: "Keep copies of everything your employer gave you on the way out.",
    },
  ],
  baseTasks: [
    { title: "Write down the separation story while it's fresh", description: "Date, who told you, exact words used, and any documents handed over. This matters for unemployment claims.", category: "Prepare", dueInDays: 2 },
    { title: "Gather pay stubs and W-2s", description: "Unemployment applications ask for employer details and earnings history — usually the last 18 months.", category: "Documents", dueInDays: 5 },
    { title: "File for unemployment benefits", description: "File in the state where you worked. Benefits start from filing date, not separation date — don't wait.", category: "Act", dueInDays: 7 },
    { title: "Review health coverage options", description: "Compare COBRA vs. marketplace plans (job loss opens a special enrollment period).", category: "Benefits", dueInDays: 14 },
    { title: "Verify final paycheck is complete", description: "Check hours, unused PTO payout, expense reimbursements, and commissions against your records.", category: "Pay", dueInDays: 7 },
    { title: "Back up personal employment records", description: "Save reviews, agreements, and key emails you're entitled to keep — access to work systems disappears fast.", category: "Documents", dueInDays: 3 },
  ],
  baseDocuments: [
    { name: "Termination / layoff letter", required: true, description: "If you didn't get one, request written confirmation of your separation date and reason." },
    { name: "Recent pay stubs (last 6 months)", required: true },
    { name: "Offer letter or employment agreement", required: true },
    { name: "Benefits summary / insurance cards", required: false },
    { name: "Severance agreement (if offered)", required: false },
    { name: "W-2 or 1099 forms", required: false },
    { name: "Employee handbook (PTO payout policy)", required: false },
  ],
  letterTemplates: [
    {
      id: "final-paycheck-followup",
      name: "Final Paycheck Follow-Up Letter",
      description: "A professional written request for your final wages, PTO payout, and reimbursements.",
      fields: [
        { id: "employer_name", label: "Employer / HR contact", placeholder: "HR Department, Acme Corp", fromAnswer: "hr_contact" },
        { id: "employer_address", label: "Employer address", multiline: true },
        { id: "last_day", label: "Last day of work", fromAnswer: "last_day" },
        { id: "amounts_owed", label: "What you believe you're owed", multiline: true, placeholder: "e.g. Final 2 weeks of wages, 32 hours unused PTO, $120 expense reimbursement" },
        { id: "return_address", label: "Your mailing address", multiline: true },
      ],
      render: (v, ctx) => `${ctx.todayLong}

To: ${v.employer_name || "[EMPLOYER / HR CONTACT]"}
${v.employer_address || "[EMPLOYER ADDRESS]"}

Re: Final Paycheck and Outstanding Compensation

Dear ${v.employer_name || "[HR CONTACT]"},

My employment ended on ${v.last_day || "[LAST DAY OF WORK]"}. I am writing to follow up on my final compensation, which I have not yet received in full.

Based on my records, the following remains outstanding:
${v.amounts_owed || "[LIST WAGES, UNUSED PTO, REIMBURSEMENTS, OR COMMISSIONS OWED]"}

Please confirm in writing when I can expect payment, or provide an itemized statement if you believe these amounts have already been paid. Many states set specific deadlines for final wage payment, and I would like to resolve this promptly and amicably.

You can reach me at the address below. Thank you for your attention to this matter.

Sincerely,

${ctx.senderName}
${v.return_address || "[YOUR MAILING ADDRESS]"}`,
    },
  ],
  disclaimer:
    "BureauOS helps you organize your separation, prepare filings, and track deadlines. It is not legal or financial advice. Unemployment rules and final-pay deadlines vary by state — verify with your state workforce agency.",
  buildPlan: (a): PlanResult => {
    const type = a.separation_type as string;
    const state = (a.state as string) || "your state";
    const gotFinalPay = a.received_final_pay === true;
    const hadInsurance = a.had_health_insurance === true;
    const severance = a.severance_offered === true;
    const ueStatus = (a.filed_unemployment as string) || "no";

    const typeLabel: Record<string, string> = {
      laid_off: "a layoff",
      fired: "a termination",
      quit: "a resignation",
      contract_ended: "the end of a contract",
    };

    const plan: PlanResult = {
      situationSummary: `You're navigating ${typeLabel[type] || "a job separation"} in ${state}. The first two weeks after separation are the highest-leverage window: unemployment filing, final pay verification, and health coverage decisions all have clocks running. This plan sequences them so nothing lapses.`,
      priority: "high",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: undefined,
      timelineEntries: [{ title: "Action plan generated", detail: "Job Separation Navigator produced an initial plan from your intake answers." }],
    };

    // Unemployment
    if (ueStatus === "no" || ueStatus === "started") {
      plan.nextActions.push({
        title: "File for unemployment this week",
        detail: `File with the ${state} workforce agency. Benefits usually start from your filing date — every week you wait is a week you can't get back.${type === "quit" ? " Quitting doesn't automatically disqualify you: 'good cause' resignations can be eligible. Answer honestly and let the agency decide." : ""}`,
      });
      plan.deadlines.push({ title: "File unemployment claim", inDays: 7, note: "Benefits generally accrue from the filing date, not the separation date." });
    } else if (ueStatus === "denied") {
      plan.priority = "urgent";
      plan.nextActions.push({
        title: "Appeal the unemployment denial",
        detail: `Denial notices state an appeal deadline — often 10 to 30 days in ${state}. Find that date on the notice and file the appeal before it. Many initial denials are reversed on appeal.`,
      });
      plan.deadlines.push({ title: "Unemployment appeal deadline", inDays: 10, note: "Estimate only — the real deadline is printed on your denial notice. Verify it today." });
      plan.riskFlags.push({ label: "Appeal window running", detail: "Unemployment appeal deadlines are strict. Missing the window usually forfeits the claim.", severity: "critical" });
      plan.extraDocuments.push({ name: "Unemployment denial notice", required: true, description: "The exact denial reason determines your appeal argument." });
    } else {
      plan.nextActions.push({
        title: "Keep certifying every week",
        detail: "While your claim is pending, complete every weekly certification on time — missed weeks are usually unrecoverable.",
      });
    }

    // Final pay
    if (!gotFinalPay) {
      plan.nextActions.push({
        title: "Send a final paycheck follow-up",
        detail: `Put your request in writing using the generated letter. ${state} likely sets a deadline for final wages${type === "fired" || type === "laid_off" ? " — often faster for involuntary separations" : ""}. A written record strengthens a wage claim if it comes to that.`,
      });
      plan.suggestedLetterTemplateId = "final-paycheck-followup";
      plan.riskFlags.push({ label: "Unpaid final wages", detail: `If the employer doesn't respond to a written request, you can file a wage claim with the ${state} labor agency — no lawyer required.`, severity: "warning" });
      plan.extraTasks.push({ title: "Calculate exactly what you're owed", description: "Final wages, unused PTO (check the handbook policy), expenses, and commissions — with your own math shown.", category: "Pay", dueInDays: 3 });
    }

    // Health insurance
    if (hadInsurance) {
      plan.nextActions.push({
        title: "Decide on health coverage before the window closes",
        detail: "You typically have 60 days to elect COBRA and 60 days for marketplace special enrollment. Marketplace plans are often much cheaper — compare both before defaulting to COBRA.",
      });
      plan.deadlines.push({ title: "COBRA election window (verify on your notice)", inDays: 60, note: "The 60-day clock starts from your COBRA election notice date — confirm the exact date on the notice." });
      plan.deadlines.push({ title: "Marketplace special enrollment closes", inDays: 60, note: "Job-based coverage loss opens a 60-day special enrollment period at healthcare.gov." });
      plan.extraDocuments.push({ name: "COBRA election notice", required: true, description: "Employers must send this after coverage ends. Chase it if it doesn't arrive within 2 weeks." });
    }

    // Severance
    if (severance) {
      plan.riskFlags.push({ label: "Severance agreement on the table", detail: "Severance agreements usually waive legal claims and have a review period (often 21 days if you're over 40). Don't sign same-day — read it fully and consider having an employment attorney review it.", severity: "warning" });
      plan.extraTasks.push({ title: "Review severance agreement carefully", description: "Note the consideration period, what claims you'd waive, non-disparagement terms, and whether it affects unemployment eligibility in your state.", category: "Prepare", dueInDays: 5 });
      plan.extraDocuments.push({ name: "Severance agreement", required: true });
    }

    if (type === "fired") {
      plan.riskFlags.push({ label: "Contested separation possible", detail: "If the employer contests your unemployment claim, your contemporaneous notes about the termination become your best evidence. Write everything down now.", severity: "info" });
    }

    // Cap next actions at 3 (extras become tasks)
    while (plan.nextActions.length > 3) {
      const extra = plan.nextActions.pop()!;
      plan.extraTasks.unshift({ title: extra.title, description: extra.detail, category: "Act", dueInDays: 7 });
    }
    if (plan.nextActions.length < 3) {
      plan.nextActions.push({ title: "Organize your employment file", detail: "Collect pay stubs, agreements, and the separation letter into one folder — you'll need them for unemployment, benefits, and any dispute." });
    }
    return plan;
  },
};

export default jobSeparation;
