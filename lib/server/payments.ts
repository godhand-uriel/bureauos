import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { SessionUser } from "@/lib/server/auth";
import { appOrigin, getProduct, isProduction, stripeMode } from "@/lib/server/commerce";
import { getStripe } from "@/lib/server/stripe";
import { queueNotification } from "@/lib/server/notify";
import { CASE_PASS, isPaidNavigator } from "@/lib/launch";

/**
 * Payments and entitlements.
 *
 * The rule this module exists to enforce: a paid entitlement is created or
 * activated in exactly three places —
 *   1. `applyEvent`, from a signature-verified Stripe webhook whose amount,
 *      currency and session match the purchase Building202 created;
 *   2. `staffGrantCasePass`, an admin action that is always audited;
 *   3. `simulatePaidPurchase`, which refuses to run in production.
 * Nothing a customer sends — not a redirect, not a request body — can do it.
 */

type Tx = Prisma.TransactionClient;

export type PaymentResult<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

/* ----------------------------- entitlements ---------------------------- */

export async function hasCasePass(caseId: string): Promise<boolean> {
  const count = await prisma.entitlement.count({
    where: { caseId, product: CASE_PASS, status: "active" },
  });
  return count > 0;
}

async function grantEntitlement(
  tx: Tx,
  args: { userId: string; caseId: string; source: "stripe" | "staff_grant" | "dev_simulation"; purchaseId?: string | null },
): Promise<void> {
  await tx.entitlement.upsert({
    where: { caseId_product: { caseId: args.caseId, product: CASE_PASS } },
    create: {
      userId: args.userId,
      caseId: args.caseId,
      product: CASE_PASS,
      status: "active",
      source: args.source,
      purchaseId: args.purchaseId ?? null,
    },
    update: {
      status: "active",
      source: args.source,
      purchaseId: args.purchaseId ?? null,
      grantedAt: new Date(),
      revokedAt: null,
      revokeReason: null,
    },
  });
}

async function revokeEntitlementForPurchase(tx: Tx, purchaseId: string, reason: string): Promise<void> {
  await tx.entitlement.updateMany({
    where: { purchaseId, product: CASE_PASS, status: "active" },
    data: { status: "revoked", revokedAt: new Date(), revokeReason: reason },
  });
}

/* ------------------------------- checkout ------------------------------ */

/**
 * Create a Stripe Checkout Session for the Case Pass on one of the caller's
 * own cases. The client supplies only the case id: product, price, currency
 * and return URLs are all decided here.
 */
export async function createCasePassCheckout(
  user: SessionUser,
  caseId: string,
  request: Request,
): Promise<PaymentResult<{ url: string; purchaseId: string }>> {
  if (stripeMode() === "off") {
    return { ok: false, status: 503, error: "Purchases are not available right now." };
  }
  const product = getProduct(CASE_PASS)!;

  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.userId !== user.id) {
    // Same response for missing and foreign cases, so ids can't be probed.
    return { ok: false, status: 404, error: "Case not found." };
  }
  if (!isPaidNavigator(kase.navigatorSlug)) {
    return { ok: false, status: 400, error: "No paid product is offered for this navigator." };
  }
  if (await hasCasePass(caseId)) {
    return { ok: false, status: 409, error: "This case already has a Case Pass." };
  }

  const stripe = getStripe();

  // Close out earlier unpaid attempts for this case so two sessions can't
  // both be paid for the same thing.
  const stale = await prisma.purchase.findMany({ where: { caseId, product: CASE_PASS, status: "pending" } });
  for (const p of stale) {
    if (p.stripeCheckoutSessionId) {
      try {
        await stripe.checkout.sessions.expire(p.stripeCheckoutSessionId);
      } catch {
        // Already completed or expired on Stripe's side — the webhook settles it.
      }
    }
  }
  await prisma.purchase.updateMany({
    where: { id: { in: stale.map((p) => p.id) }, status: "pending" },
    data: { status: "expired" },
  });

  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      caseId,
      product: CASE_PASS,
      amountCents: product.amountCents,
      currency: product.currency,
      status: "pending",
      livemode: stripeMode() === "live",
    },
  });

  const origin = appOrigin(request);
  const metadata = { purchaseId: purchase.id, caseId, userId: user.id, product: CASE_PASS };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: purchase.id,
        customer_email: user.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: product.currency,
              unit_amount: product.amountCents,
              product_data: { name: product.name, description: product.description },
            },
          },
        ],
        metadata,
        // receipt_email makes Stripe email the receipt for a live payment.
        payment_intent_data: { metadata, receipt_email: user.email },
        success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout?case=${encodeURIComponent(caseId)}&canceled=1`,
      },
      { idempotencyKey: `bureauos-checkout-${purchase.id}` },
    );
  } catch (err) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: "failed" } });
    console.error("[bureauos] Stripe checkout session creation failed", {
      purchaseId: purchase.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, status: 502, error: "Could not start checkout. Please try again." };
  }

  if (!session.url) {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: "failed" } });
    return { ok: false, status: 502, error: "Could not start checkout. Please try again." };
  }

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { stripeCheckoutSessionId: session.id },
  });
  return { ok: true, url: session.url, purchaseId: purchase.id };
}

/**
 * Close open Checkout sessions before a case or account is deleted, so a
 * payment can't complete for something that no longer exists. Best effort on
 * the Stripe side: if a session can't be expired (already paid, or Stripe is
 * unreachable) the webhook still records the payment, and fulfilment logs it
 * for refund because there is no case left to entitle.
 */
export async function cancelPendingCheckouts(where: { userId: string } | { caseId: string }): Promise<void> {
  const pending = await prisma.purchase.findMany({ where: { ...where, status: "pending" } });
  if (pending.length === 0) return;
  if (stripeMode() !== "off") {
    const stripe = getStripe();
    for (const p of pending) {
      if (!p.stripeCheckoutSessionId) continue;
      try {
        await stripe.checkout.sessions.expire(p.stripeCheckoutSessionId);
      } catch {
        // See above — settled by the webhook if it was already paid.
      }
    }
  }
  await prisma.purchase.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, status: "pending" },
    data: { status: "expired" },
  });
}

/* ------------------------------- webhooks ------------------------------ */

export type EventOutcome = "processed" | "duplicate" | "ignored";

type AfterCommit = () => Promise<unknown>;

/**
 * Apply one verified Stripe event exactly once.
 *
 * The event id is inserted into the StripeEvent ledger in the same database
 * transaction as its effects: a replayed event hits the primary key and is
 * reported as a duplicate; a failure rolls the ledger row back so Stripe's
 * retry is processed normally.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<EventOutcome> {
  const mode = stripeMode();
  if (mode === "off") return "ignored";
  if (event.livemode !== (mode === "live")) {
    // A test event on a live deployment (or the reverse) must never fulfil.
    console.warn("[bureauos] Stripe event ignored: livemode mismatch", { id: event.id, type: event.type });
    return "ignored";
  }

  if (await prisma.stripeEvent.findUnique({ where: { id: event.id } })) return "duplicate";

  const after: AfterCommit[] = [];
  try {
    const handled = await prisma.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type, livemode: event.livemode } });
      return applyEvent(tx, event, after);
    });
    for (const fn of after) {
      try {
        await fn();
      } catch (err) {
        console.error("[bureauos] post-payment side effect failed", {
          id: event.id,
          message: err instanceof Error ? err.message : "unknown",
        });
      }
    }
    return handled ? "processed" : "ignored";
  } catch (err) {
    // Lost a race with a concurrent delivery of the same event.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      (await prisma.stripeEvent.findUnique({ where: { id: event.id } }))
    ) {
      return "duplicate";
    }
    throw err;
  }
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

async function applyEvent(tx: Tx, event: Stripe.Event, after: AfterCommit[]): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return fulfilCheckout(tx, event.data.object as Stripe.Checkout.Session, event.livemode, after);

    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await tx.purchase.updateMany({
        where: { stripeCheckoutSessionId: session.id, status: "pending" },
        data: { status: event.type === "checkout.session.expired" ? "expired" : "failed" },
      });
      return result.count > 0;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return false;
      const purchase = await tx.purchase.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
      if (!purchase) return false;
      const fullyRefunded = charge.refunded === true || charge.amount_refunded >= charge.amount;
      if (!fullyRefunded) return true; // partial refund: the purchase stands
      await tx.purchase.update({ where: { id: purchase.id }, data: { status: "refunded" } });
      await revokeEntitlementForPurchase(tx, purchase.id, "refunded");
      if (purchase.userId) {
        const userId = purchase.userId;
        after.push(() =>
          queueNotification(userId, "billing_update", "Refund processed", "Your Case Pass purchase was refunded and the Case Pass has been removed from the case."),
        );
      }
      return true;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = idOf(dispute.payment_intent);
      if (!paymentIntentId) return false;
      const purchase = await tx.purchase.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
      if (!purchase) return false;
      await tx.purchase.update({ where: { id: purchase.id }, data: { status: "disputed" } });
      await revokeEntitlementForPurchase(tx, purchase.id, "payment disputed");
      return true;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = idOf(dispute.payment_intent);
      if (!paymentIntentId) return false;
      const purchase = await tx.purchase.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
      if (!purchase || purchase.status !== "disputed") return false;
      if (dispute.status === "won") {
        await tx.purchase.update({ where: { id: purchase.id }, data: { status: "paid" } });
        if (purchase.userId && purchase.caseId) {
          await grantEntitlement(tx, { userId: purchase.userId, caseId: purchase.caseId, source: "stripe", purchaseId: purchase.id });
        }
      } else {
        await tx.purchase.update({ where: { id: purchase.id }, data: { status: "dispute_lost" } });
      }
      return true;
    }

    default:
      return false;
  }
}

async function fulfilCheckout(
  tx: Tx,
  session: Stripe.Checkout.Session,
  livemode: boolean,
  after: AfterCommit[],
): Promise<boolean> {
  if (session.mode !== "payment") return false;
  const purchaseId = session.client_reference_id ?? session.metadata?.purchaseId ?? null;
  if (!purchaseId) return false;
  const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return false;

  // It must be the session Building202 created for this purchase.
  if (purchase.stripeCheckoutSessionId && purchase.stripeCheckoutSessionId !== session.id) {
    console.error("[bureauos] checkout session does not match purchase", { purchaseId });
    return false;
  }
  // "completed" can arrive before a delayed payment method has cleared.
  if (session.payment_status !== "paid") return true;
  // Never fulfil on an amount or currency Building202 did not set.
  if (session.amount_total !== purchase.amountCents || (session.currency ?? "").toLowerCase() !== purchase.currency) {
    console.error("[bureauos] paid amount does not match purchase — not fulfilled, needs review", { purchaseId });
    return true;
  }
  // Already fulfilled, or already reversed: do not (re)grant.
  if (!["pending", "expired", "failed"].includes(purchase.status)) return true;

  await tx.purchase.update({
    where: { id: purchase.id },
    data: {
      status: "paid",
      livemode,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: idOf(session.payment_intent),
    },
  });

  if (!purchase.userId || !purchase.caseId) {
    // The case or account was deleted between checkout and payment.
    console.error("[bureauos] paid purchase has no case to entitle — refund required", { purchaseId });
    return true;
  }

  await grantEntitlement(tx, { userId: purchase.userId, caseId: purchase.caseId, source: "stripe", purchaseId: purchase.id });
  await tx.timelineEvent.create({
    data: { caseId: purchase.caseId, type: "note", title: "Case Pass purchased", detail: "The letter generator is unlocked for this case." },
  });
  const userId = purchase.userId;
  after.push(() =>
    queueNotification(userId, "billing_update", "Payment received — Case Pass active", "Thanks for your purchase. The letter generator is now unlocked for your case."),
  );
  return true;
}

/* --------------------------- staff & development ----------------------- */

/** Staff override. The caller (case-actions) enforces admin + writes the audit record. */
export async function staffGrantCasePass(caseId: string, userId: string): Promise<void> {
  await prisma.$transaction((tx) => grantEntitlement(tx, { userId, caseId, source: "staff_grant" }));
}

export async function staffRevokeCasePass(caseId: string, reason: string): Promise<number> {
  const result = await prisma.entitlement.updateMany({
    where: { caseId, product: CASE_PASS, status: "active" },
    data: { status: "revoked", revokedAt: new Date(), revokeReason: reason },
  });
  return result.count;
}

/**
 * DEVELOPMENT ONLY. Records a paid purchase without Stripe so the entitled
 * experience can be exercised locally. Refuses to run in production; rows are
 * marked livemode=false / source "dev_simulation" so they can never be
 * mistaken for revenue.
 */
export async function simulatePaidPurchase(
  user: SessionUser,
  caseId: string,
): Promise<PaymentResult<{ purchaseId: string }>> {
  if (isProduction()) return { ok: false, status: 404, error: "Not available." };
  const product = getProduct(CASE_PASS)!;
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.userId !== user.id) return { ok: false, status: 404, error: "Case not found." };
  if (!isPaidNavigator(kase.navigatorSlug)) {
    return { ok: false, status: 400, error: "No paid product is offered for this navigator." };
  }
  if (await hasCasePass(caseId)) return { ok: false, status: 409, error: "This case already has a Case Pass." };

  const purchaseId = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        userId: user.id,
        caseId,
        product: CASE_PASS,
        amountCents: product.amountCents,
        currency: product.currency,
        status: "paid",
        livemode: false,
      },
    });
    await grantEntitlement(tx, { userId: user.id, caseId, source: "dev_simulation", purchaseId: purchase.id });
    await tx.timelineEvent.create({
      data: { caseId, type: "note", title: "Case Pass unlocked (development simulation)", detail: "No payment was made." },
    });
    return purchase.id;
  });
  return { ok: true, purchaseId };
}
