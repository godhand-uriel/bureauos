import type { JurisdictionRule } from "@/lib/types";

/**
 * Jurisdiction-specific rules framework.
 *
 * These are SEEDED SAMPLES demonstrating the data shape — not a complete or
 * authoritative rules database. Every rule carries its own disclaimer and a
 * lastUpdated date, and the UI always tells users to verify with official
 * agencies. In production this becomes a maintained dataset (or table —
 * see prisma/schema.prisma → JurisdictionRule) with editorial review.
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
    lastUpdated: "2026-03-01",
  },
];

/** Rules matching a case: same navigator, and state matching the intake answer (or federal). */
export function rulesForCase(navigatorSlug: string, stateAnswer: unknown): JurisdictionRule[] {
  const state = typeof stateAnswer === "string" ? stateAnswer.trim().toLowerCase() : "";
  return JURISDICTION_RULES.filter(
    (r) =>
      r.navigatorSlug === navigatorSlug &&
      (r.state.toLowerCase() === state || r.state.startsWith("Federal")),
  );
}
