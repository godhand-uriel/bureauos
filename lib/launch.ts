import type { NavigatorSlug } from "@/lib/types";

/**
 * Commercial launch scope (client-safe constants — no environment access).
 *
 * Building202 remains a six-navigator platform, but only navigators listed here
 * have a paid product. Adding one is a launch decision: it needs verified
 * deadline rules (lib/deadline-rules.ts) and `launchStatus: "live"`.
 */
export const PAID_NAVIGATORS: readonly NavigatorSlug[] = ["job-separation"];

export function isPaidNavigator(slug: string): boolean {
  return (PAID_NAVIGATORS as readonly string[]).includes(slug);
}

/** Product key for the one-time, per-case self-service purchase. */
export const CASE_PASS = "case_pass";

export const CASE_PASS_NAME = "Job Separation Case Pass";

/** What the Case Pass unlocks on its case — shown wherever it is sold. */
export const CASE_PASS_INCLUDES: readonly string[] = [
  "Letter generator for this case: final paycheck follow-up, health coverage / COBRA information request, and unemployment appeal statement",
  "Letters prefilled from your intake answers, editable, with unlimited saves",
  "One-time payment for this case — not a subscription",
];

/** Stated plainly wherever the Case Pass is sold. */
export const CASE_PASS_EXCLUDES: readonly string[] = [
  "Legal advice or legal representation",
  "Review of your case by a person",
  "Filing anything on your behalf",
  "Any guarantee of benefits, appeal results, or other outcomes",
];

/** Always free, with or without a Case Pass. */
export const FREE_INCLUDES: readonly string[] = [
  "Guided intake with saved progress",
  "Personalized action plan with next steps and risk flags",
  "Deadline tracking with the rule, its source, and NEEDS VERIFICATION where a date isn't established",
  "Task and document checklists, and a dated case timeline",
  "Support tickets",
];

export function formatPrice(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
