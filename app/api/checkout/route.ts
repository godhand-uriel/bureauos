import { NextResponse } from "next/server";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { createCasePassCheckout } from "@/lib/server/payments";
import { checkoutInputSchema } from "@/lib/schemas";

/**
 * Start a Case Pass purchase. Returns the Stripe-hosted Checkout URL; the
 * browser is redirected there and card details never touch Building202.
 * The request names a case only — price and product are server-controlled.
 * Paying does not happen here, and neither does fulfilment: the entitlement
 * is granted by the verified webhook (app/api/stripe/webhook).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = checkoutInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const result = await createCasePassCheckout(user, parsed.data.caseId, request);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
