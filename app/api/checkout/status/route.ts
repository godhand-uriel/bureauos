import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { hasCasePass } from "@/lib/server/payments";

/**
 * Read-only purchase status for the post-checkout page. This endpoint reports
 * what the webhook has recorded; it never changes a purchase and never grants
 * anything. Arriving here with a session id proves nothing about payment.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!sessionId || sessionId.length > 200) return notFound("Purchase not found.");

  const purchase = await prisma.purchase.findUnique({ where: { stripeCheckoutSessionId: sessionId } });
  if (!purchase || purchase.userId !== user.id) return notFound("Purchase not found.");

  return NextResponse.json({
    status: purchase.status,
    caseId: purchase.caseId,
    entitled: purchase.caseId ? await hasCasePass(purchase.caseId) : false,
  });
}
