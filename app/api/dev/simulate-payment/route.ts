import { NextResponse } from "next/server";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { isProduction } from "@/lib/server/commerce";
import { simulatePaidPurchase } from "@/lib/server/payments";
import { checkoutInputSchema } from "@/lib/schemas";

/**
 * DEVELOPMENT ONLY: unlock the Case Pass on one of your own cases without
 * Stripe, so the paid experience can be exercised locally. Unconditionally
 * 404 in production (and simulatePaidPurchase refuses independently).
 * Recorded as livemode=false / source "dev_simulation" — never as revenue.
 */
export async function POST(request: Request) {
  if (isProduction()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = checkoutInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const result = await simulatePaidPurchase(user, parsed.data.caseId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, simulated: true });
}
