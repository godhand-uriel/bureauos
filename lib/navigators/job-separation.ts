import type { NavigatorDef, PlanResult } from "@/lib/types";
import { isPilotState } from "@/lib/deadline-rules";
import { normalizeUsState, US_STATES } from "@/lib/us-states";

/**
 * Job Separation Navigator — BureauOS's first commercially launched navigator.
 *
 * Deadline discipline (see lib/deadline-rules.ts): unemployment appeals, final
 * pay, COBRA and Marketplace enrollment each run from a DIFFERENT event. None
 * of them is counted from the last day of work, and none is ever estimated.
 * State-specific calculation is offered for the Florida pilot only; everywhere
 * else those items are tracked as NEEDS VERIFICATION.
 */
const jobSeparation: NavigatorDef = {
  slug: "job-separation",
  name: "Job Separation Navigator",
  shortName: "Job Separation",
  tagline: "Protect your income and benefits after leaving a job.",
  description:
    "Whether you were fired, laid off, quit, or your contract ended — get an unemployment prep plan, final paycheck checklist, health coverage checklist, source-backed deadline tracking, and an organized record of your employment documents.",
  icon: "briefcase",
  accent: "38 92% 50%",
  launchStatus: "live",
  problems: [
    "Fired or laid off and unsure what to do first",
    "Final paycheck missing or incomplete",
    "Unemployment application or appeal preparation",
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
      help: "Used for context and letters. Your deadlines are NOT counted from this date — each one runs from its own notice or event.",
    },
    {
      id: "state",
      label: "Which state did you work in?",
      type: "select",
      required: true,
      help: "Deadline calculations are currently available for Florida. Other states get the organizing tools, with state deadlines marked as needing verification.",
      options: US_STATES.map((s) => ({ value: s.name, label: s.name })),
    },
    {
      id: "received_final_pay",
      label: "Have you received your final paycheck?",
      type: "boolean",
      help: "Including any unused PTO payout your employer's policy provides.",
    },
    {
      id: "next_regular_payday",
      label: "What is the regular payday for your last pay period?",
      type: "date",
      showIf: { questionId: "received_final_pay", equals: false },
      help: "The date you would normally have been paid for your final days of work. Leave blank if you're not sure.",
    },
    {
      id: "had_health_insurance",
      label: "Did you have health insurance through this employer?",
      type: "boolean",
    },
    {
      id: "coverage_end_date",
      label: "When does (or did) that health coverage end?",
      type: "date",
      showIf: { questionId: "had_health_insurance", equals: true },
      help: "Often the last day of the month you stopped working — check with HR or your insurer. Leave blank if you don't know yet.",
    },
    {
      id: "employer_size",
      label: "About how many employees does the employer have?",
      type: "select",
      showIf: { questionId: "had_health_insurance", equals: true },
      help: "Federal COBRA generally applies to employers with 20 or more employees.",
      options: [
        { value: "20_plus", label: "20 or more" },
        { value: "under_20", label: "Fewer than 20" },
        { value: "unsure", label: "Not sure" },
      ],
    },
    {
      id: "cobra_notice_received",
      label: "Have you received a COBRA election notice?",
      type: "boolean",
      showIf: { questionId: "had_health_insurance", equals: true },
      help: "A letter from the plan explaining how to keep your coverage and by when.",
    },
    {
      id: "cobra_notice_date",
      label: "What date is on the COBRA election notice?",
      type: "date",
      showIf: { questionId: "cobra_notice_received", equals: true },
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
      id: "ra_determination_mailed_date",
      label: "What mailing (distribution) date is printed on the determination notice?",
      type: "date",
      showIf: { questionId: "filed_unemployment", equals: "denied" },
      help: "The appeal period runs from this date — not from your last day of work. Leave blank if you don't have the notice in front of you; you can add it later.",
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
      help: "Optional — used to prefill your letters.",
    },
    {
      id: "situation_notes",
      label: "Anything else about how the separation happened?",
      type: "textarea",
      placeholder: "e.g. I was told it was a restructuring, but…",
      help: "Keep it general. Don't include Social Security numbers, bank details, or medical information.",
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
    { title: "Gather pay stubs and W-2s", description: "Unemployment applications ask for employer details and earnings history — have your recent pay records ready.", category: "Documents", dueInDays: 5 },
    { title: "File for unemployment benefits", description: "File with the unemployment agency for the state where you worked. Claims generally aren't paid for weeks before you file, so don't wait.", category: "Act", dueInDays: 7 },
    { title: "Review health coverage options", description: "Compare COBRA with Marketplace plans — losing job-based coverage opens a special enrollment period.", category: "Benefits", dueInDays: 14 },
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
    },
    {
      id: "cobra-notice-request",
      name: "Health Coverage / COBRA Information Request",
      description: "Ask the employer or plan administrator for your coverage end date and your continuation-coverage election notice, in writing.",
      fields: [
        { id: "recipient", label: "Employer / plan administrator", placeholder: "Benefits Department, Acme Corp", fromAnswer: "hr_contact" },
        { id: "recipient_address", label: "Their address", multiline: true },
        { id: "last_day", label: "Last day of work", fromAnswer: "last_day" },
        { id: "plan_name", label: "Health plan name (if known)", placeholder: "e.g. Acme Corp Group Health Plan" },
        { id: "return_address", label: "Your mailing address", multiline: true },
      ],
    },
    {
      id: "unemployment-appeal-statement",
      name: "Unemployment Determination Appeal Statement",
      description: "A written statement that you are appealing an unemployment determination. File it the way your notice instructs (online, mail, or fax) before the deadline printed on the notice, and keep proof of the date you filed.",
      fields: [
        { id: "agency", label: "Appeals office name / address (from your notice)", multiline: true, placeholder: "Copy this exactly from the determination notice" },
        { id: "claimant_id", label: "Claimant ID (from your notice)", placeholder: "Do not enter a Social Security number" },
        { id: "determination_date", label: "Mailing date on the determination", fromAnswer: "ra_determination_mailed_date" },
        { id: "issue_number", label: "Issue / determination number (from your notice)" },
        { id: "reasons", label: "Why you disagree", multiline: true, placeholder: "State the facts briefly and plainly. Attach supporting documents if your notice allows." },
        { id: "contact", label: "Your mailing address, phone, and email", multiline: true },
      ],
    },
  ],
  disclaimer:
    "BureauOS helps you organize your separation, prepare filings, and track deadlines. It is not legal or financial advice. Deadlines are calculated only from dates you provide and rules checked against the cited sources — the date printed on your official notice always controls. Verify with the agency or a qualified professional.",
  buildPlan: (a): PlanResult => {
    const type = a.separation_type as string;
    const state = normalizeUsState(a.state);
    const inPilot = isPilotState(state?.code);
    const stateName = state?.name ?? "your state";
    const gotFinalPay = a.received_final_pay === true;
    const hadInsurance = a.had_health_insurance === true;
    const severance = a.severance_offered === true;
    const ueStatus = (a.filed_unemployment as string) || "no";
    const employerSize = (a.employer_size as string) || "unsure";

    const typeLabel: Record<string, string> = {
      laid_off: "a layoff",
      fired: "a termination",
      quit: "a resignation",
      contract_ended: "the end of a contract",
    };

    const plan: PlanResult = {
      situationSummary:
        `You're navigating ${typeLabel[type] || "a job separation"}${state ? ` in ${state.name}` : ""}. ` +
        "Unemployment, final pay, and health coverage each run on their own clock, counted from different events — not all from your last day of work. This plan tracks them separately." +
        (inPilot
          ? ""
          : ` State-specific deadline calculations aren't available for ${stateName} yet, so those items are marked as needing verification.`),
      priority: "high",
      nextActions: [],
      extraTasks: [],
      extraDocuments: [],
      deadlines: [],
      riskFlags: [],
      suggestedLetterTemplateId: undefined,
      timelineEntries: [{ title: "Action plan generated", detail: "Job Separation Navigator produced a plan from your intake answers." }],
    };

    /* ---------------------------- Unemployment --------------------------- */
    if (ueStatus === "no" || ueStatus === "started") {
      plan.nextActions.push({
        title: "File for unemployment as soon as you can",
        detail:
          (inPilot
            ? "File a Reemployment Assistance claim with FloridaCommerce. A claim generally starts the week you file, so weeks before that usually aren't paid."
            : `File with ${stateName}'s unemployment agency. Many states don't pay for weeks before you file.`) +
          (type === "quit"
            ? " Quitting doesn't automatically disqualify you — some resignations for good cause can be eligible. Answer honestly and let the agency decide."
            : ""),
      });
    } else if (ueStatus === "denied") {
      plan.priority = "urgent";
      plan.nextActions.push({
        title: "Appeal the unemployment determination before the date on your notice",
        detail: inPilot
          ? "In Florida a determination becomes final unless you appeal within 20 days after the notice was mailed (Fla. Stat. § 443.151). The exact deadline and how to file are printed on your notice — that notice controls."
          : `Your notice states the appeal deadline and how to file. BureauOS doesn't have verified appeal rules for ${stateName} yet, so read the notice today.`,
      });
      plan.deadlines.push(
        inPilot
          ? { kind: "official", ruleId: "fl-ra-appeal" }
          : {
              kind: "official_unavailable",
              key: "unemployment-appeal",
              title: "Appeal the unemployment determination",
              note: `Not calculated: BureauOS has no verified appeal rule for ${stateName}. The deadline is printed on your determination notice.`,
            },
      );
      plan.suggestedLetterTemplateId = "unemployment-appeal-statement";
      plan.riskFlags.push({
        label: "Appeal window is running",
        detail: "Unemployment appeal deadlines are strict and are counted from the notice, not from when you read it. A late appeal is usually dismissed.",
        severity: "critical",
      });
      plan.extraDocuments.push({ name: "Unemployment determination notice", required: true, description: "The stated reason determines your appeal argument, and the mailing date starts the appeal period." });
    } else {
      plan.nextActions.push({
        title: "Keep requesting your benefit payments on schedule",
        detail: "While your claim is pending, complete every claim-week request the agency requires, on time. Missed weeks may not be payable.",
      });
    }

    /* ------------------------------ Final pay ---------------------------- */
    if (!gotFinalPay) {
      plan.nextActions.push({
        title: "Send a final paycheck follow-up",
        detail: inPilot
          ? "BureauOS did not find a Florida law setting a separate final-paycheck deadline, so the reference point is the regular payday for your last pay period. If that payday has passed, put your request in writing; the U.S. Department of Labor's Wage and Hour Division takes unpaid-wage complaints."
          : `Many states set their own final-paycheck deadline. BureauOS hasn't verified ${stateName}'s rule — check with your state labor department. Either way, put your request in writing.`,
      });
      if (plan.suggestedLetterTemplateId === undefined) {
        plan.suggestedLetterTemplateId = "final-paycheck-followup";
      }
      plan.deadlines.push({
        kind: "self_reported",
        title: "Regular payday for your final pay period",
        date: a.next_regular_payday,
        note: "The payday you entered. If it passes without full payment, send the written follow-up.",
      });
      if (!inPilot) {
        plan.deadlines.push({
          kind: "official_unavailable",
          key: "final-pay",
          title: "State final-paycheck deadline",
          note: `Not calculated: ${stateName} may set a specific deadline for final wages, which BureauOS has not verified. Check with your state labor department.`,
        });
      }
      plan.riskFlags.push({
        label: "Unpaid final wages",
        detail: inPilot
          ? "If the regular payday has passed and you still haven't been paid, you can contact the U.S. Department of Labor's Wage and Hour Division. A dated written request is your record."
          : "If the employer doesn't respond to a written request, your state labor department or the U.S. Department of Labor's Wage and Hour Division can take a wage complaint.",
        severity: "warning",
      });
      plan.extraTasks.push({ title: "Calculate exactly what you're owed", description: "Final wages, unused PTO (check the handbook policy), expenses, and commissions — with your own math shown.", category: "Pay", dueInDays: 3 });
    }

    /* --------------------------- Health coverage ------------------------- */
    if (hadInsurance) {
      plan.nextActions.push({
        title: "Decide on health coverage before the enrollment windows close",
        detail: "COBRA and the Marketplace each have their own window, counted from your coverage-end and notice dates — not from your last day of work. Compare both before choosing.",
      });

      if (inPilot && employerSize === "20_plus") {
        plan.deadlines.push({ kind: "official", ruleId: "us-cobra-election" });
      } else {
        plan.deadlines.push({
          kind: "official_unavailable",
          key: "continuation-election",
          title: "Elect continuation coverage (COBRA or state continuation)",
          note: !inPilot
            ? `Not calculated: deadline calculation is not available for ${stateName} yet. Your election notice states the deadline.`
            : employerSize === "under_20"
              ? "Not calculated: federal COBRA generally applies to employers with 20 or more employees. A smaller Florida employer may fall under Florida's state continuation law instead, which BureauOS has not verified. Ask the insurer or plan administrator for your election deadline."
              : "Not calculated: whether federal COBRA applies depends on employer size (generally 20 or more employees). Confirm with HR or the plan administrator — your election notice states the deadline.",
        });
      }

      plan.deadlines.push(
        inPilot
          ? { kind: "official", ruleId: "us-marketplace-sep" }
          : {
              kind: "official_unavailable",
              key: "marketplace-enrollment",
              title: "Enroll in Marketplace coverage (special enrollment)",
              note: `Not calculated: deadline calculation is not available for ${stateName} yet. Losing job-based coverage generally opens a limited special enrollment window — confirm yours with your state's Marketplace or HealthCare.gov.`,
            },
      );

      plan.extraDocuments.push({ name: "COBRA / continuation coverage election notice", required: true, description: "It states your election deadline and premium. If it hasn't arrived, request it in writing." });
      if (a.cobra_notice_received !== true) {
        plan.extraTasks.push({ title: "Request your coverage end date and election notice in writing", description: "Use the Health Coverage / COBRA Information Request letter. You need both dates to know your enrollment windows.", category: "Benefits", dueInDays: 5 });
      }
    }

    /* ------------------------------ Severance ---------------------------- */
    if (severance) {
      plan.riskFlags.push({
        label: "Severance agreement on the table",
        detail: "Severance agreements usually release legal claims. If you're 40 or older, federal law (29 U.S.C. § 626(f)) requires at least 21 days to consider a release of age-discrimination claims (45 days in a group layoff program) and 7 days to revoke after signing. Don't sign the same day — read it fully and consider having an employment attorney review it.",
        severity: "warning",
      });
      plan.extraTasks.push({ title: "Review severance agreement carefully", description: "Note the consideration period stated in the agreement, what claims you'd release, non-disparagement terms, and ask the unemployment agency how severance affects your claim.", category: "Prepare", dueInDays: 5 });
      plan.extraDocuments.push({ name: "Severance agreement", required: true });
    }

    if (type === "fired") {
      plan.riskFlags.push({ label: "Contested separation possible", detail: "If the employer contests your unemployment claim, your notes written close to the event become your best evidence. Write everything down now.", severity: "info" });
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
