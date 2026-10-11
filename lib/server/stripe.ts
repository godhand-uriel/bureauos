import Stripe from "stripe";
import { stripeMode } from "@/lib/server/commerce";

/**
 * Stripe client access. Nothing here runs unless STRIPE_SECRET_KEY and
 * STRIPE_WEBHOOK_SECRET are configured (see stripeMode in commerce.ts);
 * callers check that first and fail closed with a 503.
 *
 * BureauOS never sees card data: customers pay on Stripe-hosted Checkout.
 */

let cached: { key: string; client: Stripe } | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || stripeMode() === "off") {
    throw new Error("Stripe is not configured for this deployment.");
  }
  if (!cached || cached.key !== key) {
    cached = { key, client: new Stripe(key) };
  }
  return cached.client;
}

/**
 * Verify a webhook payload against its signature header. Throws if the
 * signature is missing, malformed, stale, or does not match — the raw request
 * body must be passed exactly as received.
 */
export function verifyWebhook(rawBody: string, signatureHeader: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe webhook secret is not configured.");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header.");
  // constructEvent needs only the secret (HMAC) — no API call is made.
  return Stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
}
