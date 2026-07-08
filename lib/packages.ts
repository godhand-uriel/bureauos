import type { ServiceTierDef, ServiceTierId } from "@/lib/types";

/**
 * BureauOS service packages.
 *
 * Payment processing is MOCKED in this MVP — checkout records a local
 * subscription and a mock billing entry. The tier model, checkout flow, and
 * billing UI are shaped for a drop-in Stripe integration later
 * (products/prices map 1:1 to these tiers; see README → Payments).
 */
export const SERVICE_TIERS: ServiceTierDef[] = [
  {
    id: "self_service",
    name: "Self-Service Navigator",
    priceLabel: "Free",
    priceMonthly: 0,
    tagline: "Organize any bureaucracy problem yourself.",
    included: [
      "All six navigators",
      "Guided intake & personalized action plans",
      "Task, document, and deadline tracking",
      "Letter & notice generator",
      "Case timeline and file organizer",
    ],
    notIncluded: [
      "Human review of your case",
      "Priority support response",
      "Document preparation help",
    ],
    humanAssisted: false,
  },
  {
    id: "assisted_review",
    name: "Assisted Review",
    priceLabel: "$29/mo",
    priceMonthly: 29,
    tagline: "Submit your case file for a structured review.",
    included: [
      "Everything in Self-Service",
      "Case file review by the BureauOS team",
      "Document completeness check",
      "Written review summary with flagged gaps",
      "Professional review request workflow",
    ],
    notIncluded: ["Hands-on document preparation", "Same-day response times"],
    humanAssisted: true,
    highlight: true,
  },
  {
    id: "done_with_you",
    name: "Done-With-You Support",
    priceLabel: "$79/mo",
    priceMonthly: 79,
    tagline: "Work through your case with guided, hands-on help.",
    included: [
      "Everything in Assisted Review",
      "Guided working sessions on your case",
      "Document preparation support",
      "Letter drafting assistance",
      "Case organization done with you",
    ],
    notIncluded: ["Legal representation", "Same-day response times"],
    humanAssisted: true,
  },
  {
    id: "priority",
    name: "Priority Case Support",
    priceLabel: "$149/mo",
    priceMonthly: 149,
    tagline: "Front of the queue, fastest turnaround.",
    included: [
      "Everything in Done-With-You",
      "Priority review queue (fastest turnaround)",
      "Priority support ticket handling",
      "Deadline watch on your active cases",
      "Dedicated case coordinator (assignment)",
    ],
    notIncluded: ["Legal representation or legal advice"],
    humanAssisted: true,
  },
];

export function getTier(id: ServiceTierId): ServiceTierDef {
  return SERVICE_TIERS.find((t) => t.id === id) ?? SERVICE_TIERS[0];
}

export function tierRank(id: ServiceTierId): number {
  return SERVICE_TIERS.findIndex((t) => t.id === id);
}

/** Tiers at or above Assisted Review include the professional review workflow. */
export function tierIncludesReview(id: ServiceTierId): boolean {
  return tierRank(id) >= tierRank("assisted_review");
}
