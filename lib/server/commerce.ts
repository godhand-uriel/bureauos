import { CASE_PASS, CASE_PASS_NAME } from "@/lib/launch";
import type { Capabilities } from "@/lib/types";

/**
 * Server-side commercial configuration. Prices and availability are decided
 * here from environment configuration — the client never supplies an amount,
 * a product definition, or a claim that a service is enabled.
 */

const DEFAULT_CASE_PASS_CENTS = 2900;

/**
 * Pilot price for the Case Pass, in cents. Configurable so the price can be
 * changed without a deploy of new code: BUREAUOS_CASE_PASS_PRICE_CENTS.
 * Out-of-range or malformed values fall back to the default rather than
 * producing a zero or absurd charge.
 */
export function casePassPriceCents(): number {
  const raw = process.env.BUREAUOS_CASE_PASS_PRICE_CENTS;
  if (!raw) return DEFAULT_CASE_PASS_CENTS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 100 || n > 100_000) return DEFAULT_CASE_PASS_CENTS;
  return n;
}

export interface ProductDef {
  key: string;
  name: string;
  description: string;
  amountCents: number;
  currency: string;
}

/** Server-controlled product catalog. Checkout requests name a key only. */
export function getProduct(key: string): ProductDef | null {
  if (key === CASE_PASS) {
    return {
      key: CASE_PASS,
      name: CASE_PASS_NAME,
      description:
        "One-time purchase for a single Building202 case: unlocks the letter generator for that case. Self-service software; not legal advice.",
      amountCents: casePassPriceCents(),
      currency: "usd",
    };
  }
  return null;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Stripe mode for this deployment.
 *
 * A test-mode key in a production build would let anyone "pay" with a test
 * card and receive a real entitlement, so production refuses test keys unless
 * BUREAUOS_STRIPE_ALLOW_TEST_MODE="true" is set deliberately (staging). When
 * that is on, the UI shows a test-mode banner and purchases are recorded with
 * livemode=false.
 */
export function stripeMode(): "live" | "test" | "off" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!key || !webhookSecret) return "off";
  const isTestKey = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  if (!isTestKey) return "live";
  if (isProduction() && process.env.BUREAUOS_STRIPE_ALLOW_TEST_MODE !== "true") return "off";
  return "test";
}

/**
 * Human-assisted packages (Assisted Review, Done-With-You, Priority) and the
 * professional-review workflow are off unless explicitly enabled. Enabling is
 * an operations decision: it requires real, qualified staffing and a defined
 * scope — it is not a feature toggle to flip for a demo.
 */
export function humanReviewEnabled(): boolean {
  return process.env.BUREAUOS_HUMAN_REVIEW_ENABLED === "true";
}

/** Real email delivery is configured (Resend). */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function capabilities(): Capabilities {
  const product = getProduct(CASE_PASS)!;
  return {
    payments: stripeMode(),
    casePass: { priceCents: product.amountCents, currency: product.currency, name: product.name },
    humanReview: humanReviewEnabled(),
    emailDelivery: emailConfigured() ? "live" : isProduction() ? "off" : "mock",
    sms: false,
    uploads: false,
    devTools: !isProduction(),
  };
}

/** Public origin for building absolute URLs (Stripe return URLs, emails). */
export function appOrigin(request?: Request): string {
  const configured = process.env.BUREAUOS_APP_URL ?? process.env.AUTH_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to the request origin
    }
  }
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}
