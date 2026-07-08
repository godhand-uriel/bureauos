import type { NavigatorDef, NavigatorSlug } from "@/lib/types";
import dmv from "./dmv";
import jobSeparation from "./job-separation";
import smallBusiness from "./small-business";
import insuranceDenial from "./insurance-denial";
import veteranBenefits from "./veteran-benefits";
import tenantRights from "./tenant-rights";

export const NAVIGATORS: NavigatorDef[] = [
  dmv,
  jobSeparation,
  smallBusiness,
  insuranceDenial,
  veteranBenefits,
  tenantRights,
];

export function getNavigator(slug: string): NavigatorDef | undefined {
  return NAVIGATORS.find((n) => n.slug === slug);
}

export function isNavigatorSlug(slug: string): slug is NavigatorSlug {
  return NAVIGATORS.some((n) => n.slug === slug);
}
