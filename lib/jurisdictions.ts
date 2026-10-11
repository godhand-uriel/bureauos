import type { JurisdictionRule } from "@/lib/types";
import { isPilotState } from "@/lib/deadline-rules";
import { normalizeUsState } from "@/lib/us-states";

/**
 * Jurisdiction notes: plain-language process information shown beside a plan.
 *
 * Each entry carries a `reviewStatus`:
 *  - "source_checked": the text was checked against the linked source on
 *    `lastUpdated`. That is an engineering source check, pending attorney
 *    review. Only these are ever shown to customers (see rulesForCase).
 *  - "unverified_sample": illustrative content from the original MVP, kept
 *    so it can be validated later. Never shown as guidance.
 *
 * Calculable deadlines live in lib/deadline-rules.ts; these notes describe
 * the surrounding process and link the same sources.
 */

const VERIFY =
  "This is general process information, not legal advice. Rules change and vary by locality — verify with the official agency or a qualified professional before acting.";

export const JURISDICTION_RULES: JurisdictionRule[] = [
  {
    id: "ca-tenant-repairs",
    state: "California",
    agency: "California Department of Consumer Affairs / local code enforcement",
    navigatorSlug: "tenant-rights",
    category: "Habitability & repairs",
    title: "California repair request basics",
    summary:
      "California requires landlords to keep rentals habitable. After written notice, landlords get a 'reasonable time' to repair — commonly presumed 30 days, much shorter for urgent issues. Remedies like repair-and-deduct exist but have strict limits.",
    deadlineType: "Repair response window",
    deadlineDetail:
      "'Reasonable time' after written notice; 30 days is a common presumption, far less for heat/water/safety issues.",
    requiredDocuments: ["Written repair request (dated)", "Photos of conditions", "Lease agreement", "Rent payment records"],
    processSteps: [
      "Send a dated written repair request and keep a copy",
      "Document conditions with dated photos",
      "Allow a reasonable response window",
      "Escalate to local code enforcement if ignored",
      "Get legal-aid advice before using repair-and-deduct or withholding",
    ],
    officialLinks: [
      { label: "CA tenant guide (courts.ca.gov)", url: "https://selfhelp.courts.ca.gov/tenant" },
      { label: "CA Civil Code §1941–1942", url: "https://leginfo.legislature.ca.gov" },
    ],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-06-01",
  },
  {
    id: "ca-deposit-return",
    state: "California",
    agency: "California courts (small claims)",
    navigatorSlug: "tenant-rights",
    category: "Security deposits",
    title: "California deposit return deadline",
    summary:
      "Landlords must return the deposit or send an itemized statement within 21 days of move-out. Bad-faith withholding can expose the landlord to up to 2× the deposit in damages.",
    deadlineType: "Deposit return",
    deadlineDetail: "21 days from move-out.",
    requiredDocuments: ["Move-in/move-out photos", "Lease", "Forwarding address proof"],
    processSteps: [
      "Provide a forwarding address in writing at move-out",
      "Wait the 21-day statutory window",
      "Send a written demand citing the deadline if it passes",
      "File in small claims if unresolved",
    ],
    officialLinks: [{ label: "CA small claims self-help", url: "https://selfhelp.courts.ca.gov/small-claims" }],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-06-01",
  },
  {
    id: "tx-dmv-reinstatement",
    state: "Texas",
    agency: "Texas Department of Public Safety (DPS)",
    navigatorSlug: "dmv",
    category: "License reinstatement",
    title: "Texas license reinstatement basics",
    summary:
      "Texas license eligibility and reinstatement fees are handled by DPS, not the DMV. The License Eligibility system shows exactly what's owed and required; compliance items (like ticket payments) clear through the courts that reported them.",
    deadlineType: "Notice response",
    deadlineDetail: "Respond by any date printed on a DPS enforcement notice; suspensions extend if requirements go unmet.",
    requiredDocuments: ["Photo ID", "Compliance proof from the reporting court", "Reinstatement fee payment", "SR-22 if insurance-related"],
    processSteps: [
      "Check the DPS License Eligibility page for holds and fees",
      "Resolve each compliance item with the reporting court",
      "Pay reinstatement fees online",
      "Confirm eligibility status shows clear before driving",
    ],
    officialLinks: [{ label: "TX DPS License Eligibility", url: "https://www.dps.texas.gov/section/driver-license" }],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-05-15",
  },
  {
    id: "wa-final-paycheck",
    state: "Washington",
    agency: "Washington Department of Labor & Industries (L&I)",
    navigatorSlug: "job-separation",
    category: "Final wages",
    title: "Washington final paycheck timing",
    summary:
      "In Washington, final wages are due by the end of the established pay period — i.e., on the next regularly scheduled payday — regardless of whether you quit or were terminated. Unpaid final wages can be pursued through an L&I wage complaint at no cost.",
    deadlineType: "Final wage payment",
    deadlineDetail: "Next regularly scheduled payday after separation.",
    requiredDocuments: ["Final pay stub (or absence of one)", "Time records", "Separation notice"],
    processSteps: [
      "Confirm the next scheduled payday after your last day",
      "Send a written request if payment doesn't arrive",
      "File a wage complaint with L&I if unresolved",
    ],
    officialLinks: [{ label: "L&I wage complaints", url: "https://lni.wa.gov/workers-rights" }],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-04-20",
  },
  {
    id: "us-health-appeal",
    state: "Federal (US)",
    agency: "HHS / state insurance departments",
    navigatorSlug: "insurance-denial",
    category: "Health claim appeals",
    title: "ACA internal appeal & external review windows",
    summary:
      "For most non-grandfathered health plans, you have 180 days from a denial to file an internal appeal. After a final internal denial, you generally have 4 months to request an independent external review. Urgent situations qualify for expedited (72-hour) handling.",
    deadlineType: "Appeal windows",
    deadlineDetail: "180 days (internal appeal) / 4 months (external review) — confirm on your denial letter.",
    requiredDocuments: ["Denial letter / EOB", "Policy or benefits booklet", "Medical records", "Provider support letter"],
    processSteps: [
      "File the internal appeal in writing within the window",
      "Request expedited handling if care is urgent",
      "After a final denial, request external review",
      "File a state insurance department complaint in parallel if needed",
    ],
    officialLinks: [{ label: "Healthcare.gov appeals guide", url: "https://www.healthcare.gov/appeal-insurance-company-decision/" }],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-06-10",
  },
  {
    id: "us-va-decision-review",
    state: "Federal (US)",
    agency: "Department of Veterans Affairs",
    navigatorSlug: "veteran-benefits",
    category: "Decision reviews",
    title: "VA decision review options (AMA)",
    summary:
      "Under the Appeals Modernization Act you generally have one year from a decision to choose a review lane: Supplemental Claim (new evidence), Higher-Level Review (same evidence, senior reviewer), or Board Appeal. Filing within the year protects your effective date.",
    deadlineType: "Decision review",
    deadlineDetail: "1 year from the date on the decision letter.",
    requiredDocuments: ["Decision letter (all pages)", "New and relevant evidence (Supplemental Claim)", "C-file if requested"],
    processSteps: [
      "Read the decision letter's reasons for the rating/denial",
      "Pick the review lane with an accredited VSO",
      "File the correct review form before the one-year mark",
    ],
    officialLinks: [{ label: "VA decision reviews", url: "https://www.va.gov/decision-reviews/" }],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-05-30",
  },
  {
    id: "fl-annual-report",
    state: "Florida",
    agency: "Florida Division of Corporations (Sunbiz)",
    navigatorSlug: "small-business",
    category: "Annual filings",
    title: "Florida annual report deadline",
    summary:
      "Florida entities must file an annual report with Sunbiz between January 1 and May 1 each year. Filing after May 1 adds a $400 late fee for most entities, and continued non-filing leads to administrative dissolution in September.",
    deadlineType: "Annual report",
    deadlineDetail: "May 1 (a $400 late fee applies after; dissolution follows in late September).",
    requiredDocuments: ["Entity document number", "Registered agent info", "Principal address", "Filing fee payment"],
    processSteps: [
      "Look up the entity on Sunbiz",
      "File the annual report online before May 1",
      "Save the confirmation to your compliance folder",
      "Calendar next January 1 as the window opening",
    ],
    officialLinks: [{ label: "Sunbiz annual report", url: "https://dos.fl.gov/sunbiz/" }],
    disclaimer: VERIFY,
    reviewStatus: "unverified_sample",
    lastUpdated: "2026-03-01",
  },

  /* ---------------------------------------------------------------- */
  /* Job Separation — Florida pilot. Source-checked (see lastUpdated). */
  /* ---------------------------------------------------------------- */
  {
    id: "fl-ra-appeal",
    state: "Florida",
    agency: "FloridaCommerce — Reemployment Assistance",
    navigatorSlug: "job-separation",
    category: "Unemployment appeals",
    title: "Florida Reemployment Assistance: appealing a determination",
    summary:
      "A determination becomes final unless an appeal is filed within 20 days after the notice is mailed to your last known address, or within 20 days after delivery if it was not mailed. The period runs from the notice — not from your last day of work.",
    deadlineType: "Appeal period",
    deadlineDetail: "20 days after the mailing (or delivery) date of the determination notice.",
    requiredDocuments: ["The determination notice (all pages)", "Records supporting your account of the separation"],
    processSteps: [
      "Find the mailing/distribution date and the appeal instructions on the notice",
      "File the appeal the way the notice instructs, before the deadline printed on it",
      "Keep proof of the date you filed",
      "Keep requesting benefit payments while the appeal is pending, if the agency instructs you to",
    ],
    officialLinks: [
      { label: "Fla. Stat. § 443.151 (Florida Senate)", url: "https://www.flsenate.gov/Laws/Statutes/2025/443.151" },
    ],
    disclaimer: VERIFY,
    reviewStatus: "source_checked",
    lastUpdated: "2026-10-10",
  },
  {
    id: "fl-final-pay",
    state: "Florida",
    agency: "U.S. Department of Labor — Wage and Hour Division",
    navigatorSlug: "job-separation",
    category: "Final wages",
    title: "Final paycheck timing in Florida",
    summary:
      "BureauOS did not find a Florida statute that sets a separate deadline for a final paycheck. Federal law does not require an employer to pay final wages immediately; the U.S. Department of Labor's guidance is to act once the regular payday for your last pay period has passed without payment.",
    deadlineType: "Reference date",
    deadlineDetail: "The regular payday for the last pay period you worked — a date only you and your employer know.",
    requiredDocuments: ["Final pay stub (or note that none was issued)", "Your own record of hours and pay owed", "Employer PTO policy, if you expect a payout"],
    processSteps: [
      "Identify the regular payday for your final pay period",
      "If it passes without full payment, send a dated written request",
      "If unresolved, contact the U.S. Department of Labor's Wage and Hour Division",
    ],
    officialLinks: [
      { label: "U.S. DOL — Last Paycheck", url: "https://www.dol.gov/general/topic/wages/lastpaycheck" },
    ],
    disclaimer:
      VERIFY +
      " The absence of a Florida final-pay statute was confirmed from secondary sources only and is pending attorney review.",
    reviewStatus: "source_checked",
    lastUpdated: "2026-10-11",
  },
  {
    id: "us-cobra-election",
    state: "Federal (US)",
    agency: "U.S. Department of Labor — Employee Benefits Security Administration",
    navigatorSlug: "job-separation",
    category: "Health coverage",
    title: "COBRA continuation coverage: election period",
    summary:
      "A plan covered by federal COBRA must give you at least 60 days to elect continuation coverage, measured from the later of the date you would lose coverage or the date the election notice is sent. Federal COBRA generally applies to employers with 20 or more employees.",
    deadlineType: "Election period",
    deadlineDetail: "At least 60 days after the later of coverage loss or the election notice date.",
    requiredDocuments: ["COBRA election notice", "Proof of your coverage end date"],
    processSteps: [
      "Confirm your coverage end date with the employer or insurer",
      "Find the election deadline stated on the election notice",
      "Compare COBRA premiums with Marketplace options before electing",
    ],
    officialLinks: [
      { label: "26 C.F.R. § 54.4980B-6 (Cornell LII)", url: "https://www.law.cornell.edu/cfr/text/26/54.4980B-6" },
      { label: "U.S. DOL Health Benefits Advisor", url: "https://webapps.dol.gov/elaws/ebsa/health/89.asp" },
    ],
    disclaimer: VERIFY,
    reviewStatus: "source_checked",
    lastUpdated: "2026-10-10",
  },
  {
    id: "us-marketplace-sep",
    state: "Federal (US)",
    agency: "Centers for Medicare & Medicaid Services — HealthCare.gov",
    navigatorSlug: "job-separation",
    category: "Health coverage",
    title: "Marketplace special enrollment after losing job-based coverage",
    summary:
      "Losing job-based coverage opens a Special Enrollment Period: generally 60 days after the coverage ends, and you can apply up to 60 days before it ends. The period runs from when coverage actually ends, which may be later than your last day of work.",
    deadlineType: "Special enrollment period",
    deadlineDetail: "60 days after the date job-based coverage ends.",
    requiredDocuments: ["Proof that your coverage ended or will end, with the date"],
    processSteps: [
      "Get written confirmation of your coverage end date",
      "Apply at HealthCare.gov within the window",
      "Keep proof of the coverage loss — the Marketplace may ask for it",
    ],
    officialLinks: [
      { label: "CMS — Losing Job-Based Coverage", url: "https://www.cms.gov/marketplace/outreach-and-education/losing-job-based-coverage.pdf" },
      { label: "HealthCare.gov", url: "https://www.healthcare.gov/" },
    ],
    disclaimer: VERIFY,
    reviewStatus: "source_checked",
    lastUpdated: "2026-10-11",
  },
];

/**
 * Jurisdiction notes shown on a case's plan.
 *
 * Only `source_checked` rules are ever returned — unverified samples stay in
 * the file as content to validate later and are never presented as guidance.
 * Federal rules are included only when the case's state is in the launch
 * pilot, so a state BureauOS has not validated gets no jurisdiction notes at
 * all rather than a partial picture.
 */
export function rulesForCase(navigatorSlug: string, stateAnswer: unknown): JurisdictionRule[] {
  const state = normalizeUsState(stateAnswer);
  if (!state || !isPilotState(state.code)) return [];
  return JURISDICTION_RULES.filter(
    (r) =>
      r.reviewStatus === "source_checked" &&
      r.navigatorSlug === navigatorSlug &&
      (r.state === state.name || r.state.startsWith("Federal")),
  );
}
