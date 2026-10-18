import type { AnswerValue, NavigatorSlug } from "@/lib/types";
import { addDays, compareDateOnly, formatDateOnly, parseDateOnly, type DateOnly } from "@/lib/dates";
import { floridaRaClosure } from "@/lib/holidays";

/**
 * Registry of official deadline rules BureauOS is willing to calculate.
 *
 * A rule exists here only if its text was checked against the cited sources
 * on `sourceCheckedOn`. That is an ENGINEERING SOURCE CHECK — it is not
 * attorney review, and every rule remains subject to the counsel-review
 * launch gate.
 *
 * A date is produced only when EVERY triggering event the rule depends on is
 * known: never from the user's last day of work, never from "today", never
 * from an estimate. Any trigger missing → no date; the UI shows NEEDS
 * VERIFICATION and asks for the missing date.
 *
 * To add a rule: confirm the text in the primary source, record the citation,
 * URLs and check date, and add tests in tests/deadlines.test.ts.
 */

export interface RuleTrigger {
  /** Intake answer that holds this date. */
  questionId: string;
  label: string;
  /** Coverage can end later this month; a notice cannot be provided tomorrow. */
  mayBeFuture: boolean;
  /** Why this date is needed — shown when it is missing. */
  whyNeeded: string;
}

export interface LastDayRule {
  /** Why `date` is not a day the deadline may fall on, or null if it is. */
  closedReason: (date: DateOnly) => string | null;
  /** One line for the deadline note, e.g. "the next business day". */
  movesTo: string;
}

export interface DeadlineRule {
  id: string;
  navigatorSlug: NavigatorSlug;
  jurisdiction: { code: string; name: string };
  title: string;
  /**
   * Every event the period depends on. The count runs from the LATEST of
   * them, and all must be known before a date is calculated.
   */
  triggers: RuleTrigger[];
  offsetDays: number;
  /** When set, a last day that falls on a closed day moves forward. */
  lastDay?: LastDayRule;
  ruleSummary: string;
  citation: string;
  sourceUrl: string;
  /** Further primary sources the calculation relies on. */
  references: { label: string; url: string }[];
  /** Date the rule text was last checked against the sources. */
  sourceCheckedOn: DateOnly;
  caveats: string;
}

export const DEADLINE_RULES: DeadlineRule[] = [
  {
    id: "fl-ra-appeal",
    navigatorSlug: "job-separation",
    jurisdiction: { code: "FL", name: "Florida" },
    title: "Appeal the Reemployment Assistance determination",
    triggers: [
      {
        questionId: "ra_determination_mailed_date",
        label: "Distributed date on the determination",
        mayBeFuture: false,
        whyNeeded: "The 20-day appeal period is counted from the determination's distributed date.",
      },
    ],
    offsetDays: 20,
    lastDay: {
      closedReason: floridaRaClosure,
      movesTo: "the next business day",
    },
    ruleSummary:
      "A request for an appeal hearing must be filed within 20 calendar days after the date of the determination (its “distributed date”). If the 20th day is a Saturday, Sunday, or legal holiday, the last day to file is the next business day.",
    citation: "FloridaCommerce, “File an Appeal”; Fla. Admin. Code R. 73B-20.005(1); Fla. Stat. § 443.151(4)(b)1.",
    sourceUrl: "https://floridajobs.org/workforce-resources/reemployment-assistance/claimants/file-an-appeal",
    references: [
      { label: "Fla. Admin. Code R. 73B-20.005, Computation of Time", url: "https://www.flrules.org/gateway/ruleNo.asp?id=73B-20.005" },
      { label: "Fla. Stat. § 443.151", url: "https://www.flsenate.gov/Laws/Statutes/2025/443.151" },
      { label: "Fla. Stat. § 110.117, state holidays", url: "https://www.flsenate.gov/Laws/Statutes/2025/110.117" },
      { label: "5 U.S.C. § 6103, federal holidays (Postal Service closures)", url: "https://www.law.cornell.edu/uscode/text/5/6103" },
    ],
    sourceCheckedOn: "2026-10-18",
    caveats:
      "Days are counted from the day after the distributed date. A last day on a weekend, a Florida state holiday (Fla. Stat. § 110.117), or a federal holiday when the Postal Service is closed moves to the next business day. BureauOS cannot know about unscheduled closures — a FloridaCommerce office closure or an emergency order extending deadlines for your area — which can only make the real deadline later. The deadline printed on your notice controls.",
  },
  {
    id: "us-cobra-election",
    navigatorSlug: "job-separation",
    jurisdiction: { code: "US", name: "Federal (US)" },
    title: "Elect COBRA continuation coverage",
    triggers: [
      {
        questionId: "cobra_notice_provided_date",
        label: "Date the COBRA election notice was provided to you",
        mayBeFuture: false,
        whyNeeded:
          "The period runs from the date the notice was actually provided (sent or handed to you) — not just the date printed on it.",
      },
      {
        questionId: "coverage_end_date",
        label: "Date your employer health coverage ends",
        mayBeFuture: true,
        whyNeeded: "The period runs from whichever is later: losing coverage or the date the notice was provided.",
      },
    ],
    offsetDays: 60,
    ruleSummary:
      "A plan covered by federal COBRA must give you an election period that does not end before 60 days after the later of (1) the date you would lose coverage and (2) the date the election notice is provided to you.",
    citation: "26 C.F.R. § 54.4980B-6, Q&A-1(a)",
    sourceUrl: "https://www.law.cornell.edu/cfr/text/26/54.4980B-6",
    references: [],
    sourceCheckedOn: "2026-10-18",
    caveats:
      "This is the earliest date federal rules allow the election period to end; your plan may allow longer, and the deadline stated in your election notice is the one to act on. The count is not moved off weekends or holidays. Federal COBRA generally applies only to employers with 20 or more employees.",
  },
  {
    id: "us-marketplace-sep",
    navigatorSlug: "job-separation",
    jurisdiction: { code: "US", name: "Federal (US)" },
    title: "Enroll in Marketplace coverage (special enrollment)",
    triggers: [
      {
        questionId: "coverage_end_date",
        label: "Date your employer health coverage ends",
        mayBeFuture: true,
        whyNeeded: "The 60-day window runs from the date your coverage actually ends.",
      },
    ],
    offsetDays: 60,
    ruleSummary:
      "Losing job-based health coverage opens a Marketplace Special Enrollment Period. You generally have 60 days after the coverage ends to enroll, and you can apply up to 60 days before it ends.",
    citation: "CMS, “Losing Job-Based Coverage” (HealthCare.gov Marketplace consumer guide)",
    sourceUrl: "https://www.cms.gov/marketplace/outreach-and-education/losing-job-based-coverage.pdf",
    references: [],
    sourceCheckedOn: "2026-10-11",
    caveats:
      "The 60 days run from the date coverage actually ends, which may be later than your last day of work. Voluntarily dropping coverage usually does not qualify. Confirm your window at HealthCare.gov.",
  },
];

export function getDeadlineRule(id: string): DeadlineRule | undefined {
  return DEADLINE_RULES.find((r) => r.id === id);
}

/** States where BureauOS offers state-specific deadline calculation. */
export const PILOT_STATE_CODES: readonly string[] = ["FL"];

export function isPilotState(code: string | null | undefined): boolean {
  return Boolean(code) && PILOT_STATE_CODES.includes(code as string);
}

export type RuleComputation =
  | {
      status: "calculated";
      date: DateOnly;
      /** The event the count actually ran from (the latest trigger). */
      basis: { questionId: string; label: string; date: DateOnly };
      /** Day `offsetDays` before any move off a closed day. */
      countedDate: DateOnly;
      /** Closed days skipped to reach `date` (empty when it didn't move). */
      skipped: { date: DateOnly; reason: string }[];
    }
  | {
      status: "needs_verification";
      reason: string;
      /** The first trigger still needed, so the UI can ask for it. */
      missing: RuleTrigger;
    };

function readTrigger(
  trigger: RuleTrigger,
  answers: Record<string, AnswerValue>,
  today: DateOnly,
): { date: DateOnly } | { problem: "missing" | "future" } {
  const raw = answers[trigger.questionId];
  if (!parseDateOnly(raw)) return { problem: "missing" };
  const date = (raw as string).trim();
  if (!trigger.mayBeFuture && compareDateOnly(date, today) > 0) return { problem: "future" };
  return { date };
}

/**
 * Calculate a rule's deadline from intake answers. Returns a date only when
 * every trigger is a valid calendar date (and not in the future when it
 * cannot be). `today` is used solely for that plausibility check.
 */
export function computeRuleDeadline(
  rule: DeadlineRule,
  answers: Record<string, AnswerValue>,
  today: DateOnly,
): RuleComputation {
  const read = rule.triggers.map((trigger) => ({ trigger, value: readTrigger(trigger, answers, today) }));

  const future = read.find((r) => "problem" in r.value && r.value.problem === "future");
  if (future) {
    return {
      status: "needs_verification",
      reason: `Not calculated: the ${lowerFirst(future.trigger.label)} you entered is in the future. Check the date on your paperwork.`,
      missing: future.trigger,
    };
  }
  const missing = read.filter((r) => "problem" in r.value).map((r) => r.trigger);
  if (missing.length > 0) {
    const needed = missing.map((t) => lowerFirst(t.label)).join(" and the ");
    return {
      status: "needs_verification",
      reason: `Not calculated: BureauOS needs the ${needed}. ${missing[0].whyNeeded}`,
      missing: missing[0],
    };
  }

  // All known: the period runs from the latest event.
  let basis = { questionId: "", label: "", date: "" };
  for (const r of read) {
    const date = (r.value as { date: DateOnly }).date;
    if (!basis.date || compareDateOnly(date, basis.date) > 0) {
      basis = { questionId: r.trigger.questionId, label: r.trigger.label, date };
    }
  }

  const countedDate = addDays(basis.date, rule.offsetDays);
  let date = countedDate;
  const skipped: { date: DateOnly; reason: string }[] = [];
  if (rule.lastDay) {
    for (let reason = rule.lastDay.closedReason(date); reason; reason = rule.lastDay.closedReason(date)) {
      skipped.push({ date, reason });
      date = addDays(date, 1);
      if (skipped.length > 14) throw new Error(`No open day within two weeks of ${countedDate}`);
    }
  }
  return { status: "calculated", date, basis, countedDate, skipped };
}

/** Plain-language explanation of how a calculated date was reached. */
export function explainCalculation(rule: DeadlineRule, c: Extract<RuleComputation, { status: "calculated" }>): string {
  const base = `Calculated as ${rule.offsetDays} days after the ${lowerFirst(c.basis.label)} (${c.basis.date}).`;
  const moved =
    c.skipped.length > 0 && rule.lastDay
      ? ` Day ${rule.offsetDays} is ${formatDateOnly(c.countedDate)} (${c.skipped[0].reason})` +
        (c.skipped.length > 1
          ? `, and the next ${c.skipped.length - 1 === 1 ? "day is" : `${c.skipped.length - 1} days are`} closed too (${c.skipped
              .slice(1)
              .map((s) => s.reason)
              .join("; ")})`
          : "") +
        `, so the deadline moves to ${rule.lastDay.movesTo}.`
      : "";
  return `${base}${moved} Confirm it matches the deadline printed on your official notice.`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
