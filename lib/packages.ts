import type { ServiceTierDef, ServiceTierId } from "@/lib/types";

/**
 * Case service tiers.
 *
 * Every case is "self_service". The three human-assisted tiers describe a
 * staffed service that is NOT currently offered: they cannot be purchased,
 * and staff can only apply one when BUREAUOS_HUMAN_REVIEW_ENABLED is on
 * (lib/server/commerce.ts). They carry no price — pricing a human service is
 * a decision for when it is actually staffed.
 *
 * The one thing Building202 sells today is the per-case Case Pass, which is an
 * entitlement (lib/launch.ts, lib/server/payments.ts), not a tier.
 */
export const SERVICE_TIERS: ServiceTierDef[] = [
  {
    id: "self_service",
    name: "Self-Service",
    tagline: "Organize your case yourself with the Building202 tools.",
    humanAssisted: false,
  },
  {
    id: "assisted_review",
    name: "Assisted Review",
    tagline: "A structured completeness review of your case file by Building202 staff.",
    humanAssisted: true,
  },
  {
    id: "done_with_you",
    name: "Done-With-You Support",
    tagline: "Guided working sessions on your case.",
    humanAssisted: true,
  },
  {
    id: "priority",
    name: "Priority Case Support",
    tagline: "Priority handling in the review queue.",
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
