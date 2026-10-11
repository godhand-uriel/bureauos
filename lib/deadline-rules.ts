import type { AnswerValue, NavigatorSlug } from "@/lib/types";
import { addDays, compareDateOnly, laterOf, parseDateOnly, type DateOnly } from "@/lib/dates";

/**
 * Registry of official deadline rules BureauOS is willing to calculate.
 *
 * A rule exists here only if its text was checked against the cited source on
 * `sourceCheckedOn`. That is an ENGINEERING SOURCE CHECK — it is not attorney
 * review, and every rule remains subject to the counsel-review launch gate.
 *
 * A date is produced only when the rule's actual triggering event is known:
 * never from the user's last day of work, never from "today", never from an
 * estimate. Missing trigger → no date; the UI shows NEEDS VERIFICATION.
 *
 * To add a rule: confirm the text in the primary source, record the citation,
 * URL and check date, and add a test in tests/deadlines.test.ts.
 */

export interface RuleTrigger {
  /** Intake answer that holds this date. */
  questionId: string;
  label: string;
  /** Coverage can end later this month; a notice cannot be dated tomorrow. */
  mayBeFuture: boolean;
}

export interface DeadlineRule {
  id: string;
  navigatorSlug: NavigatorSlug;
  jurisdiction: { code: string; name: string };
  title: string;
  trigger: RuleTrigger;
  /** Optional second event: the period runs from the LATER of the two. */
  laterOf?: RuleTrigger;
  offsetDays: number;
  ruleSummary: string;
  citation: string;
  sourceUrl: string;
  /** Date the rule text was last checked against the source. */
  sourceCheckedOn: DateOnly;
  caveats: string;
}

export const DEADLINE_RULES: DeadlineRule[] = [
  {
    id: "fl-ra-appeal",
    navigatorSlug: "job-separation",
    jurisdiction: { code: "FL", name: "Florida" },
    title: "Appeal the Reemployment Assistance determination",
    trigger: {
      questionId: "ra_determination_mailed_date",
      label: "Mailing (distribution) date printed on the determination notice",
      mayBeFuture: false,
    },
    offsetDays: 20,
    ruleSummary:
      "A Florida Reemployment Assistance determination becomes final unless an appeal is filed within 20 days after the notice is mailed to your last known address (or within 20 days after delivery, if it was not mailed).",
    citation: "Fla. Stat. § 443.151(3)(c) and (4)(b)1.",
    sourceUrl: "https://www.flsenate.gov/Laws/Statutes/2025/443.151",
    sourceCheckedOn: "2026-10-10",
    caveats:
      "Counted as 20 calendar days after the mailing date. BureauOS does not move the date if it lands on a weekend or holiday. The deadline printed on your notice controls.",
  },
  {
    id: "us-cobra-election",
    navigatorSlug: "job-separation",
    jurisdiction: { code: "US", name: "Federal (US)" },
    title: "Elect COBRA continuation coverage",
    trigger: {
      questionId: "cobra_notice_date",
      label: "Date on your COBRA election notice",
      mayBeFuture: false,
    },
    laterOf: {
      questionId: "coverage_end_date",
      label: "Date your employer health coverage ends",
      mayBeFuture: true,
    },
    offsetDays: 60,
    ruleSummary:
      "A plan covered by federal COBRA must give you at least 60 days to elect continuation coverage, measured from the later of the date you would lose coverage or the date the election notice is sent.",
    citation: "26 C.F.R. § 54.4980B-6, Q&A-1",
    sourceUrl: "https://www.law.cornell.edu/cfr/text/26/54.4980B-6",
    sourceCheckedOn: "2026-10-10",
    caveats:
      "Federal COBRA generally applies only to employers with 20 or more employees. Your plan may allow longer than 60 days — the election notice states your plan's deadline, and that notice controls.",
  },
  {
    id: "us-marketplace-sep",
    navigatorSlug: "job-separation",
    jurisdiction: { code: "US", name: "Federal (US)" },
    title: "Enroll in Marketplace coverage (special enrollment)",
    trigger: {
      questionId: "coverage_end_date",
      label: "Date your employer health coverage ends",
      mayBeFuture: true,
    },
    offsetDays: 60,
    ruleSummary:
      "Losing job-based health coverage opens a Marketplace Special Enrollment Period. You generally have 60 days after the coverage ends to enroll, and you can apply up to 60 days before it ends.",
    citation: "CMS, “Losing Job-Based Coverage” (HealthCare.gov Marketplace consumer guide)",
    sourceUrl: "https://www.cms.gov/marketplace/outreach-and-education/losing-job-based-coverage.pdf",
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
      /** The event the count actually ran from (after any later-of comparison). */
      basis: { questionId: string; label: string; date: DateOnly };
    }
  | { status: "needs_verification"; reason: string };

function readTrigger(
  trigger: RuleTrigger,
  answers: Record<string, AnswerValue>,
  today: DateOnly,
): { date: DateOnly } | { missing: true } | { future: true } {
  const raw = answers[trigger.questionId];
  if (!parseDateOnly(raw)) return { missing: true };
  const date = (raw as string).trim();
  if (!trigger.mayBeFuture && compareDateOnly(date, today) > 0) return { future: true };
  return { date };
}

/**
 * Calculate a rule's deadline from intake answers. Returns a date only when
 * the primary trigger is a valid calendar date (and not in the future when it
 * cannot be). `today` is used solely for that plausibility check.
 */
export function computeRuleDeadline(
  rule: DeadlineRule,
  answers: Record<string, AnswerValue>,
  today: DateOnly,
): RuleComputation {
  const primary = readTrigger(rule.trigger, answers, today);
  if ("missing" in primary) {
    return {
      status: "needs_verification",
      reason: `Not calculated: BureauOS needs the ${lowerFirst(rule.trigger.label)}. Find it on your official notice.`,
    };
  }
  if ("future" in primary) {
    return {
      status: "needs_verification",
      reason: `Not calculated: the ${lowerFirst(rule.trigger.label)} you entered is in the future. Check the date on your notice.`,
    };
  }

  let basis = { questionId: rule.trigger.questionId, label: rule.trigger.label, date: primary.date };
  if (rule.laterOf) {
    const other = readTrigger(rule.laterOf, answers, today);
    if ("date" in other && laterOf(other.date, primary.date) === other.date && other.date !== primary.date) {
      basis = { questionId: rule.laterOf.questionId, label: rule.laterOf.label, date: other.date };
    }
  }

  return { status: "calculated", date: addDays(basis.date, rule.offsetDays), basis };
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
