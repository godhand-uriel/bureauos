import { prisma } from "@/lib/server/db";
import type { SessionUser } from "@/lib/server/auth";
import { hasCasePass } from "@/lib/server/payments";
import { isPaidNavigator } from "@/lib/launch";
import { DISCLAIMER_VERSION } from "@/lib/constants";

/**
 * Whether a session may generate or save letters on a case. One function so
 * the render route and the save action cannot drift apart.
 *
 *  - staff: always (support work on a customer's case)
 *  - the per-case terms/privacy/disclaimer acceptance must be on record
 *  - in a paid navigator, the case needs an active Case Pass (402)
 *  - preview navigators have no paid product; their letters stay free
 */
export async function letterAccess(
  user: SessionUser,
  kase: { id: string; userId: string; navigatorSlug: string },
): Promise<{ ok: true } | { ok: false; status: 402 | 403; error: string }> {
  if (user.role === "admin") return { ok: true };

  const accepted = await prisma.disclaimerAcceptance.count({
    where: { userId: kase.userId, caseId: kase.id, version: DISCLAIMER_VERSION },
  });
  if (accepted === 0) {
    return {
      ok: false,
      status: 403,
      error: "Terms, privacy, and disclaimer acceptance is required for this case first.",
    };
  }

  if (isPaidNavigator(kase.navigatorSlug) && !(await hasCasePass(kase.id))) {
    return {
      ok: false,
      status: 402,
      error: "The letter generator is part of the Case Pass for this case.",
    };
  }
  return { ok: true };
}
