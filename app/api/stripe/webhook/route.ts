import { NextResponse } from "next/server";
import { stripeMode } from "@/lib/server/commerce";
import { verifyWebhook } from "@/lib/server/stripe";
import { processStripeEvent } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint — the only path by which a payment can activate an
 * entitlement.
 *
 *  - Authenticated by signature, not by session (excluded from the session
 *    and origin checks in middleware.ts).
 *  - The raw body is verified against Stripe-Signature before anything is
 *    parsed or trusted; a bad or missing signature is a 400.
 *  - Processing is idempotent (lib/server/payments.ts): Stripe may deliver an
 *    event more than once and out of order.
 *  - A processing failure returns 500 so Stripe retries; the event's ledger
 *    row is rolled back with its effects.
 */
export async function POST(request: Request) {
  if (stripeMode() === "off") {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const outcome = await processStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error("[bureauos] Stripe event processing failed", {
      id: event.id,
      type: event.type,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
