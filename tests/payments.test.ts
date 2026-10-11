import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

/**
 * Payments and entitlements. Real route handlers, real database, real Stripe
 * signature verification (Stripe.webhooks.constructEvent against payloads
 * signed with the SDK's own test-header generator). The only things replaced
 * are the session lookup and the outbound Stripe API client — no network.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentUser: any = null;

vi.mock("@/lib/server/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    getSessionUser: async () => currentUser,
    unauthorized: () => NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message = "Not found.") => NextResponse.json({ error: message }, { status: 404 }),
    badRequest: (detail: unknown) =>
      NextResponse.json({ error: "Invalid request.", detail }, { status: 400 }),
  };
});

const stripeApi = vi.hoisted(() => ({
  create: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("@/lib/server/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/stripe")>();
  return {
    ...actual, // verifyWebhook stays real
    getStripe: () => ({ checkout: { sessions: { create: stripeApi.create, expire: stripeApi.expire } } }),
  };
});

import { prisma } from "@/lib/server/db";
import { wipeDatabase } from "@/lib/server/seed-db";
import { capabilities, casePassPriceCents, stripeMode } from "@/lib/server/commerce";
import { hasCasePass } from "@/lib/server/payments";
import { performCaseAction } from "@/lib/server/case-actions";
import { DISCLAIMER_VERSION } from "@/lib/constants";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { GET as checkoutStatusGET } from "@/app/api/checkout/status/route";
import { POST as webhookPOST } from "@/app/api/stripe/webhook/route";
import { POST as simulatePOST } from "@/app/api/dev/simulate-payment/route";
import { POST as renderPOST } from "@/app/api/cases/[id]/letters/render/route";
import { POST as caseActionPOST } from "@/app/api/cases/[id]/actions/route";
import { POST as casesPOST } from "@/app/api/cases/route";
import { GET as bootstrapGET } from "@/app/api/bootstrap/route";

const WEBHOOK_SECRET = "whsec_test_bureauos_unit";
const withPrefs = { notificationPrefs: true } as const;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) =>
  new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let alice: any, bob: any, admin: any;
let sessionCounter = 0;
let eventCounter = 0;

function configureStripe() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_not_a_real_key");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
}

async function newCase(userId: string, navigatorSlug = "job-separation", accepted = true) {
  const kase = await prisma.case.create({
    data: { userId, navigatorSlug, title: `${navigatorSlug} case ${Math.random().toString(36).slice(2, 8)}` },
  });
  if (accepted) {
    await prisma.disclaimerAcceptance.create({
      data: {
        userId, caseId: kase.id, version: DISCLAIMER_VERSION,
        acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true,
      },
    });
  }
  return kase;
}

/** Start a real checkout through the route; returns the purchase + fake session id. */
async function startCheckout(user: typeof alice, caseId: string) {
  currentUser = user;
  const res = await checkoutPOST(json({ caseId }));
  expect(res.status).toBe(200);
  const purchase = await prisma.purchase.findFirstOrThrow({
    where: { caseId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  return { purchase, sessionId: purchase.stripeCheckoutSessionId! };
}

function makeEvent(type: string, object: Record<string, unknown>, opts: { id?: string; livemode?: boolean } = {}) {
  return {
    id: opts.id ?? `evt_test_${++eventCounter}`,
    object: "event",
    api_version: "2025-01-01",
    created: Math.floor(Date.now() / 1000),
    livemode: opts.livemode ?? false,
    type,
    data: { object },
  };
}

function signedRequest(payload: string, opts: { secret?: string; timestamp?: number; header?: string | null } = {}) {
  const header =
    opts.header !== undefined
      ? opts.header
      : Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: opts.secret ?? WEBHOOK_SECRET,
          ...(opts.timestamp ? { timestamp: opts.timestamp } : {}),
        });
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(header ? { "stripe-signature": header } : {}) },
    body: payload,
  });
}

async function deliver(event: ReturnType<typeof makeEvent>) {
  const res = await webhookPOST(signedRequest(JSON.stringify(event)));
  return { status: res.status, body: await res.json() };
}

function completedSession(
  purchase: { id: string; amountCents: number; currency: string },
  sessionId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    client_reference_id: purchase.id,
    payment_status: "paid",
    amount_total: purchase.amountCents,
    currency: purchase.currency,
    payment_intent: `pi_${sessionId}`,
    metadata: { purchaseId: purchase.id },
    ...overrides,
  };
}

/** Checkout + a valid paid webhook: the one legitimate way to get a Case Pass. */
async function payFor(user: typeof alice, caseId: string) {
  const { purchase, sessionId } = await startCheckout(user, caseId);
  const result = await deliver(makeEvent("checkout.session.completed", completedSession(purchase, sessionId)));
  expect(result.status).toBe(200);
  expect(result.body.outcome).toBe("processed");
  return { purchase, sessionId, paymentIntent: `pi_${sessionId}` };
}

beforeAll(async () => {
  await wipeDatabase(prisma);
  await prisma.purchase.deleteMany({});
  await prisma.stripeEvent.deleteMany({});
  alice = await prisma.user.create({
    data: { email: "alice@example.com", name: "Alice Customer", passwordHash: "x", role: "customer" },
    include: withPrefs,
  });
  bob = await prisma.user.create({
    data: { email: "bob@example.com", name: "Bob Customer", passwordHash: "x", role: "customer" },
    include: withPrefs,
  });
  admin = await prisma.user.create({
    data: { email: "ops@example.com", name: "Ops Admin", passwordHash: "x", role: "admin" },
    include: withPrefs,
  });
});

beforeEach(() => {
  currentUser = null;
  stripeApi.create.mockReset();
  stripeApi.expire.mockReset();
  stripeApi.expire.mockResolvedValue({});
  stripeApi.create.mockImplementation(async () => {
    const id = `cs_test_${++sessionCounter}`;
    return { id, url: `https://checkout.stripe.test/c/pay/${id}` };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ */

describe("configuration fails closed", () => {
  it("payments are off without both Stripe secrets", () => {
    expect(stripeMode()).toBe("off");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    expect(stripeMode()).toBe("off"); // no webhook secret → cannot verify → off
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    expect(stripeMode()).toBe("test");
  });

  it("production refuses a test-mode key unless staging explicitly allows it", () => {
    configureStripe();
    vi.stubEnv("NODE_ENV", "production");
    expect(stripeMode()).toBe("off");
    expect(capabilities().payments).toBe("off");
    vi.stubEnv("BUREAUOS_STRIPE_ALLOW_TEST_MODE", "true");
    expect(stripeMode()).toBe("test");
    vi.stubEnv("BUREAUOS_STRIPE_ALLOW_TEST_MODE", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit_not_a_real_key");
    expect(stripeMode()).toBe("live");
  });

  it("price comes from server configuration and rejects nonsense values", () => {
    expect(casePassPriceCents()).toBe(2900);
    vi.stubEnv("BUREAUOS_CASE_PASS_PRICE_CENTS", "4900");
    expect(casePassPriceCents()).toBe(4900);
    for (const bad of ["0", "-500", "12.5", "abc", "99", "10000000"]) {
      vi.stubEnv("BUREAUOS_CASE_PASS_PRICE_CENTS", bad);
      expect(casePassPriceCents()).toBe(2900);
    }
  });

  it("production capabilities never advertise dev tools, SMS, uploads, or mock email", () => {
    vi.stubEnv("NODE_ENV", "production");
    const caps = capabilities();
    expect(caps).toMatchObject({ devTools: false, sms: false, uploads: false, emailDelivery: "off", humanReview: false });
  });
});

/* ------------------------------------------------------------------ */

describe("POST /api/checkout", () => {
  it("requires a session", async () => {
    configureStripe();
    expect((await checkoutPOST(json({ caseId: "anything" }))).status).toBe(401);
    expect(stripeApi.create).not.toHaveBeenCalled();
  });

  it("returns 503 and records nothing when Stripe is not configured", async () => {
    const kase = await newCase(alice.id);
    currentUser = alice;
    const res = await checkoutPOST(json({ caseId: kase.id }));
    expect(res.status).toBe(503);
    expect(stripeApi.create).not.toHaveBeenCalled();
    expect(await prisma.purchase.count({ where: { caseId: kase.id } })).toBe(0);
  });

  it("refuses someone else's case, a missing case, and a navigator with no paid product", async () => {
    configureStripe();
    const bobsCase = await newCase(bob.id);
    const dmvCase = await newCase(alice.id, "dmv");
    currentUser = alice;
    expect((await checkoutPOST(json({ caseId: bobsCase.id }))).status).toBe(404);
    expect((await checkoutPOST(json({ caseId: "does-not-exist" }))).status).toBe(404);
    expect((await checkoutPOST(json({ caseId: dmvCase.id }))).status).toBe(400);
    expect(stripeApi.create).not.toHaveBeenCalled();
    expect(await prisma.purchase.count({ where: { caseId: { in: [bobsCase.id, dmvCase.id] } } })).toBe(0);
  });

  it("creates the session server-side: client-supplied price and product are ignored", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    currentUser = alice;
    const res = await checkoutPOST(
      json({ caseId: kase.id, amount: 1, amountCents: 1, priceCents: 1, product: "free", currency: "jpy", userId: bob.id }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).url).toMatch(/^https:\/\/checkout\.stripe\.test\//);

    expect(stripeApi.create).toHaveBeenCalledTimes(1);
    const [args, options] = stripeApi.create.mock.calls[0];
    expect(args.mode).toBe("payment");
    expect(args.line_items).toHaveLength(1);
    expect(args.line_items[0].quantity).toBe(1);
    expect(args.line_items[0].price_data.unit_amount).toBe(2900);
    expect(args.line_items[0].price_data.currency).toBe("usd");
    expect(args.success_url).toContain("/checkout/return?session_id={CHECKOUT_SESSION_ID}");
    expect(args.metadata.userId).toBe(alice.id);
    expect(options.idempotencyKey).toMatch(/^bureauos-checkout-/);

    const purchase = await prisma.purchase.findFirstOrThrow({ where: { caseId: kase.id } });
    expect(purchase).toMatchObject({ userId: alice.id, status: "pending", amountCents: 2900, currency: "usd", livemode: false });
    expect(args.client_reference_id).toBe(purchase.id);
    // Creating a checkout session grants nothing.
    expect(await hasCasePass(kase.id)).toBe(false);
  });

  it("charges the configured price", async () => {
    configureStripe();
    vi.stubEnv("BUREAUOS_CASE_PASS_PRICE_CENTS", "4900");
    const kase = await newCase(alice.id);
    currentUser = alice;
    expect((await checkoutPOST(json({ caseId: kase.id }))).status).toBe(200);
    expect(stripeApi.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(4900);
    expect((await prisma.purchase.findFirstOrThrow({ where: { caseId: kase.id } })).amountCents).toBe(4900);
  });

  it("expires an earlier unpaid attempt before starting a new one", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const first = await startCheckout(alice, kase.id);
    await startCheckout(alice, kase.id);
    expect(stripeApi.expire).toHaveBeenCalledWith(first.sessionId);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: first.purchase.id } })).status).toBe("expired");
    expect(await prisma.purchase.count({ where: { caseId: kase.id, status: "pending" } })).toBe(1);
  });

  it("marks the purchase failed if Stripe rejects session creation", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    stripeApi.create.mockRejectedValueOnce(new Error("stripe unavailable"));
    currentUser = alice;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkoutPOST(json({ caseId: kase.id }))).status).toBe(502);
    errors.mockRestore();
    expect((await prisma.purchase.findFirstOrThrow({ where: { caseId: kase.id } })).status).toBe("failed");
    expect(await hasCasePass(kase.id)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("POST /api/stripe/webhook — signature verification", () => {
  it("returns 503 when Stripe is not configured", async () => {
    const res = await webhookPOST(signedRequest(JSON.stringify(makeEvent("checkout.session.completed", {}))));
    expect(res.status).toBe(503);
  });

  it("rejects a missing, wrong-secret, tampered, or stale signature — and applies nothing", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const { purchase, sessionId } = await startCheckout(alice, kase.id);
    const payload = JSON.stringify(makeEvent("checkout.session.completed", completedSession(purchase, sessionId)));

    const attempts = [
      signedRequest(payload, { header: null }),
      signedRequest(payload, { header: "t=1,v1=deadbeef" }),
      signedRequest(payload, { secret: "whsec_someone_elses_secret" }),
      // Valid signature, but for a different body than the one delivered.
      signedRequest(payload.replace(`"amount_total":${purchase.amountCents}`, '"amount_total":1'), {
        header: Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }),
      }),
      // Correctly signed but 10 minutes old (outside Stripe's replay tolerance).
      signedRequest(payload, { timestamp: Math.floor(Date.now() / 1000) - 600 }),
    ];
    for (const request of attempts) {
      expect((await webhookPOST(request)).status).toBe(400);
    }
    expect(await hasCasePass(kase.id)).toBe(false);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe("pending");
  });
});

/* ------------------------------------------------------------------ */

describe("fulfilment", () => {
  it("the return redirect alone activates nothing; the verified webhook does", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const { purchase, sessionId } = await startCheckout(alice, kase.id);

    // Customer lands on the return page before (or without) any webhook.
    currentUser = alice;
    const statusUrl = `http://localhost:3000/api/checkout/status?session_id=${sessionId}`;
    const before = await (await checkoutStatusGET(new Request(statusUrl))).json();
    expect(before).toMatchObject({ status: "pending", entitled: false });
    expect(await hasCasePass(kase.id)).toBe(false);
    // Polling the status endpoint any number of times changes nothing.
    await checkoutStatusGET(new Request(statusUrl));
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe("pending");

    // Another customer cannot read this purchase's status.
    currentUser = bob;
    expect((await checkoutStatusGET(new Request(statusUrl))).status).toBe(404);

    const result = await deliver(makeEvent("checkout.session.completed", completedSession(purchase, sessionId)));
    expect(result).toMatchObject({ status: 200, body: { outcome: "processed" } });

    currentUser = alice;
    const after = await (await checkoutStatusGET(new Request(statusUrl))).json();
    expect(after).toMatchObject({ status: "paid", entitled: true, caseId: kase.id });
    const entitlement = await prisma.entitlement.findFirstOrThrow({ where: { caseId: kase.id } });
    expect(entitlement).toMatchObject({ status: "active", source: "stripe", userId: alice.id, purchaseId: purchase.id });
    const paid = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(paid.stripePaymentIntentId).toBe(`pi_${sessionId}`);
  });

  it("is idempotent: a replayed event and a second event for the same session grant once", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const { purchase, sessionId } = await startCheckout(alice, kase.id);
    const event = makeEvent("checkout.session.completed", completedSession(purchase, sessionId));

    expect((await deliver(event)).body.outcome).toBe("processed");
    expect((await deliver(event)).body.outcome).toBe("duplicate");
    expect((await deliver(event)).body.outcome).toBe("duplicate");
    // A different event id about the same already-fulfilled session.
    await deliver(makeEvent("checkout.session.async_payment_succeeded", completedSession(purchase, sessionId)));

    expect(await prisma.entitlement.count({ where: { caseId: kase.id } })).toBe(1);
    expect(await prisma.stripeEvent.count({ where: { id: event.id } })).toBe(1);
    expect(await prisma.timelineEvent.count({ where: { caseId: kase.id, title: "Case Pass purchased" } })).toBe(1);
    expect(
      await prisma.notificationEvent.count({ where: { userId: alice.id, subject: { contains: "Case Pass active" } } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("concurrent deliveries of the same event still grant exactly once", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const { purchase, sessionId } = await startCheckout(alice, kase.id);
    const event = makeEvent("checkout.session.completed", completedSession(purchase, sessionId));
    const results = await Promise.all([deliver(event), deliver(event), deliver(event)]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.outcome === "processed")).toHaveLength(1);
    expect(await prisma.entitlement.count({ where: { caseId: kase.id } })).toBe(1);
    expect(await prisma.timelineEvent.count({ where: { caseId: kase.id, title: "Case Pass purchased" } })).toBe(1);
  });

  it("does not fulfil an amount or currency BureauOS did not set", async () => {
    configureStripe();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const override of [{ amount_total: 100 }, { currency: "jpy" }]) {
      const kase = await newCase(alice.id);
      const { purchase, sessionId } = await startCheckout(alice, kase.id);
      await deliver(makeEvent("checkout.session.completed", completedSession(purchase, sessionId, override)));
      expect(await hasCasePass(kase.id)).toBe(false);
      expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe("pending");
    }
    errors.mockRestore();
  });

  it("does not fulfil a session that is not the one created for the purchase", async () => {
    configureStripe();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const kase = await newCase(alice.id);
    const { purchase } = await startCheckout(alice, kase.id);
    // A paid session from elsewhere in the same Stripe account, pointed at this purchase.
    await deliver(makeEvent("checkout.session.completed", completedSession(purchase, "cs_test_unrelated_session")));
    errors.mockRestore();
    expect(await hasCasePass(kase.id)).toBe(false);
  });

  it("waits for delayed payment methods: 'completed' while unpaid grants nothing", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const { purchase, sessionId } = await startCheckout(alice, kase.id);
    await deliver(
      makeEvent("checkout.session.completed", completedSession(purchase, sessionId, { payment_status: "unpaid" })),
    );
    expect(await hasCasePass(kase.id)).toBe(false);
    await deliver(makeEvent("checkout.session.async_payment_succeeded", completedSession(purchase, sessionId)));
    expect(await hasCasePass(kase.id)).toBe(true);
  });

  it("ignores events from the wrong Stripe mode", async () => {
    configureStripe(); // test mode
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kase = await newCase(alice.id);
    const { purchase, sessionId } = await startCheckout(alice, kase.id);
    const event = makeEvent("checkout.session.completed", completedSession(purchase, sessionId), { livemode: true });
    expect((await deliver(event)).body.outcome).toBe("ignored");
    warnings.mockRestore();
    expect(await hasCasePass(kase.id)).toBe(false);
    expect(await prisma.stripeEvent.count({ where: { id: event.id } })).toBe(0);
  });

  it("records expired and failed sessions without granting", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    const first = await startCheckout(alice, kase.id);
    await deliver(makeEvent("checkout.session.expired", { id: first.sessionId, object: "checkout.session" }));
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: first.purchase.id } })).status).toBe("expired");

    const second = await startCheckout(alice, kase.id);
    await deliver(makeEvent("checkout.session.async_payment_failed", { id: second.sessionId, object: "checkout.session" }));
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: second.purchase.id } })).status).toBe("failed");
    expect(await hasCasePass(kase.id)).toBe(false);
  });

  it("acknowledges unrelated event types without side effects", async () => {
    configureStripe();
    const result = await deliver(makeEvent("customer.created", { id: "cus_x", object: "customer" }));
    expect(result).toMatchObject({ status: 200, body: { outcome: "ignored" } });
  });
});

/* ------------------------------------------------------------------ */

describe("refunds and disputes", () => {
  it("a full refund revokes the Case Pass; a partial refund does not", async () => {
    configureStripe();
    const partial = await newCase(alice.id);
    const p1 = await payFor(alice, partial.id);
    await deliver(
      makeEvent("charge.refunded", {
        id: "ch_partial", object: "charge", payment_intent: p1.paymentIntent,
        amount: 2900, amount_refunded: 1000, refunded: false,
      }),
    );
    expect(await hasCasePass(partial.id)).toBe(true);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p1.purchase.id } })).status).toBe("paid");

    const full = await newCase(alice.id);
    const p2 = await payFor(alice, full.id);
    await deliver(
      makeEvent("charge.refunded", {
        id: "ch_full", object: "charge", payment_intent: p2.paymentIntent,
        amount: 2900, amount_refunded: 2900, refunded: true,
      }),
    );
    expect(await hasCasePass(full.id)).toBe(false);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p2.purchase.id } })).status).toBe("refunded");
    const entitlement = await prisma.entitlement.findFirstOrThrow({ where: { caseId: full.id } });
    expect(entitlement).toMatchObject({ status: "revoked", revokeReason: "refunded" });

    // The paid feature is locked again, server-side.
    currentUser = alice;
    const render = await renderPOST(json({ templateId: "final-paycheck-followup", values: {} }), params(full.id));
    expect(render.status).toBe(402);

    // A replayed "completed" event must not resurrect a refunded purchase.
    await deliver(makeEvent("checkout.session.completed", completedSession(p2.purchase, p2.sessionId)));
    expect(await hasCasePass(full.id)).toBe(false);
  });

  it("a dispute suspends access; winning restores it, losing does not", async () => {
    configureStripe();
    const won = await newCase(alice.id);
    const p1 = await payFor(alice, won.id);
    await deliver(makeEvent("charge.dispute.created", { id: "dp_1", object: "dispute", payment_intent: p1.paymentIntent, status: "needs_response" }));
    expect(await hasCasePass(won.id)).toBe(false);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p1.purchase.id } })).status).toBe("disputed");
    await deliver(makeEvent("charge.dispute.closed", { id: "dp_1", object: "dispute", payment_intent: p1.paymentIntent, status: "won" }));
    expect(await hasCasePass(won.id)).toBe(true);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p1.purchase.id } })).status).toBe("paid");

    const lost = await newCase(alice.id);
    const p2 = await payFor(alice, lost.id);
    await deliver(makeEvent("charge.dispute.created", { id: "dp_2", object: "dispute", payment_intent: p2.paymentIntent, status: "needs_response" }));
    await deliver(makeEvent("charge.dispute.closed", { id: "dp_2", object: "dispute", payment_intent: p2.paymentIntent, status: "lost" }));
    expect(await hasCasePass(lost.id)).toBe(false);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p2.purchase.id } })).status).toBe("dispute_lost");
  });

  it("ignores refunds for payments BureauOS has no record of", async () => {
    configureStripe();
    const result = await deliver(
      makeEvent("charge.refunded", { id: "ch_x", object: "charge", payment_intent: "pi_unknown", amount: 2900, amount_refunded: 2900, refunded: true }),
    );
    expect(result).toMatchObject({ status: 200, body: { outcome: "ignored" } });
  });
});

/* ------------------------------------------------------------------ */

describe("the Case Pass gates the letter generator on the server", () => {
  it("locks rendering and saving until the case is entitled", async () => {
    configureStripe();
    const kase = await newCase(alice.id);
    currentUser = alice;

    const locked = await renderPOST(json({ templateId: "final-paycheck-followup", values: {} }), params(kase.id));
    expect(locked.status).toBe(402);
    expect((await locked.json()).code).toBe("case_pass_required");

    // Saving a letter typed elsewhere is the same paid feature.
    const save = { type: "save_letter", id: "letter-locked-0001", templateId: "final-paycheck-followup", title: "t", letterBody: "body" };
    expect((await caseActionPOST(json(save), params(kase.id))).status).toBe(402);
    expect(await prisma.generatedLetter.count({ where: { caseId: kase.id } })).toBe(0);

    await payFor(alice, kase.id);
    currentUser = alice;
    const res = await renderPOST(
      json({ templateId: "final-paycheck-followup", values: { employer_name: "Acme HR", ignored_field: "x" } }),
      params(kase.id),
    );
    expect(res.status).toBe(200);
    const letter = await res.json();
    expect(letter.body).toContain("Acme HR");
    expect(letter.body).toContain("Alice Customer");
    expect(letter.body).toContain("[EMPLOYER ADDRESS]");
    expect(letter.body).not.toContain("ignored_field");

    expect((await caseActionPOST(json({ ...save, id: "letter-unlocked-0001" }), params(kase.id))).status).toBe(200);
    expect(await prisma.generatedLetter.count({ where: { caseId: kase.id } })).toBe(1);
  });

  it("one case's pass never unlocks another case", async () => {
    configureStripe();
    const paidCase = await newCase(alice.id);
    const otherCase = await newCase(alice.id);
    await payFor(alice, paidCase.id);
    currentUser = alice;
    expect((await renderPOST(json({ templateId: "cobra-notice-request", values: {} }), params(paidCase.id))).status).toBe(200);
    expect((await renderPOST(json({ templateId: "cobra-notice-request", values: {} }), params(otherCase.id))).status).toBe(402);
  });

  it("requires acceptance, hides foreign cases, and rejects unknown templates", async () => {
    configureStripe();
    const noAcceptance = await newCase(alice.id, "dmv", false);
    const bobsCase = await newCase(bob.id);
    const dmv = await newCase(alice.id, "dmv");
    currentUser = alice;
    expect((await renderPOST(json({ templateId: "dmv-records-request", values: {} }), params(noAcceptance.id))).status).toBe(403);
    expect((await renderPOST(json({ templateId: "final-paycheck-followup", values: {} }), params(bobsCase.id))).status).toBe(404);
    expect((await renderPOST(json({ templateId: "no-such-template", values: {} }), params(dmv.id))).status).toBe(404);
    // A job-separation template is not available on a DMV case.
    expect((await renderPOST(json({ templateId: "final-paycheck-followup", values: {} }), params(dmv.id))).status).toBe(404);
    const saveUnknown = { type: "save_letter", id: "letter-unknown-0001", templateId: "no-such-template", title: "t", letterBody: "b" };
    expect((await caseActionPOST(json(saveUnknown), params(dmv.id))).status).toBe(400);
  });

  it("preview navigators have no paid product: their letters stay free", async () => {
    const dmv = await newCase(alice.id, "dmv");
    currentUser = alice;
    const res = await renderPOST(json({ templateId: "dmv-records-request", values: {} }), params(dmv.id));
    expect(res.status).toBe(200);
    expect((await res.json()).body).toContain("[DMV OFFICE NAME AND ADDRESS]");
  });

  it("staff can render on a customer's case (as the customer) without a pass", async () => {
    const kase = await newCase(alice.id);
    currentUser = admin;
    const res = await renderPOST(json({ templateId: "unemployment-appeal-statement", values: {} }), params(kase.id));
    expect(res.status).toBe(200);
    expect((await res.json()).body).toContain("Claimant: Alice Customer");
  });
});

/* ------------------------------------------------------------------ */

describe("entitlements cannot be self-granted", () => {
  it("customers cannot grant or revoke a Case Pass through the case API", async () => {
    const kase = await newCase(alice.id);
    currentUser = alice;
    expect((await caseActionPOST(json({ type: "grant_case_pass", reason: "please" }), params(kase.id))).status).toBe(403);
    expect((await caseActionPOST(json({ type: "revoke_case_pass", reason: "please" }), params(kase.id))).status).toBe(403);
    expect(await hasCasePass(kase.id)).toBe(false);
  });

  it("staff grant and revoke are audited, and require a reason", async () => {
    const kase = await newCase(alice.id);
    currentUser = admin;
    expect((await caseActionPOST(json({ type: "grant_case_pass", reason: "" }), params(kase.id))).status).toBe(400);
    expect((await caseActionPOST(json({ type: "grant_case_pass", reason: "goodwill after outage" }), params(kase.id))).status).toBe(200);
    expect(await hasCasePass(kase.id)).toBe(true);
    const entitlement = await prisma.entitlement.findFirstOrThrow({ where: { caseId: kase.id } });
    expect(entitlement).toMatchObject({ source: "staff_grant", userId: alice.id, purchaseId: null });
    expect(await prisma.auditLog.count({ where: { action: "case.grant_case_pass", targetId: kase.id } })).toBe(1);
    expect((await caseActionPOST(json({ type: "grant_case_pass", reason: "twice" }), params(kase.id))).status).toBe(409);

    expect((await caseActionPOST(json({ type: "revoke_case_pass", reason: "granted in error" }), params(kase.id))).status).toBe(200);
    expect(await hasCasePass(kase.id)).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "case.revoke_case_pass", targetId: kase.id } })).toBe(1);
    expect((await caseActionPOST(json({ type: "revoke_case_pass", reason: "again" }), params(kase.id))).status).toBe(409);
  });

  it("staff cannot grant a pass on a navigator that has no paid product", async () => {
    const dmv = await newCase(alice.id, "dmv");
    const result = await performCaseAction(admin, dmv.id, { type: "grant_case_pass", reason: "n/a here" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("new cases always start self-service, whatever the request body claims", async () => {
    currentUser = alice;
    const res = await casesPOST(json({ navigatorSlug: "job-separation", serviceTier: "priority", entitled: true }));
    expect(res.status).toBe(200);
    const created = (await res.json()).case;
    expect(created.serviceTier).toBe("self_service");
    expect(await hasCasePass(created.id)).toBe(false);
  });

  it("bootstrap scopes entitlements and purchases to their owner and never exposes Stripe ids", async () => {
    configureStripe();
    const alicesCase = await newCase(alice.id);
    const bobsCase = await newCase(bob.id);
    await payFor(alice, alicesCase.id);
    await payFor(bob, bobsCase.id);

    currentUser = bob;
    const raw = JSON.stringify(await (await bootstrapGET()).json());
    const data = JSON.parse(raw);
    expect(data.entitlements.every((e: { userId: string }) => e.userId === bob.id)).toBe(true);
    expect(data.purchases.every((p: { userId: string }) => p.userId === bob.id)).toBe(true);
    expect(data.entitlements.some((e: { caseId: string }) => e.caseId === bobsCase.id)).toBe(true);
    expect(raw).not.toContain("cs_test_");
    expect(raw).not.toContain("pi_cs_test_");
    expect(data.capabilities.payments).toBe("test");
    expect(data.capabilities.casePass.priceCents).toBe(2900);
  });
});

/* ------------------------------------------------------------------ */

describe("development payment simulation is isolated from production", () => {
  it("works in development and is recorded as a simulation, not revenue", async () => {
    const kase = await newCase(alice.id);
    currentUser = alice;
    expect((await simulatePOST(json({ caseId: kase.id }))).status).toBe(200);
    expect(await hasCasePass(kase.id)).toBe(true);
    const entitlement = await prisma.entitlement.findFirstOrThrow({ where: { caseId: kase.id } });
    expect(entitlement.source).toBe("dev_simulation");
    const purchase = await prisma.purchase.findFirstOrThrow({ where: { caseId: kase.id } });
    expect(purchase).toMatchObject({ livemode: false, stripeCheckoutSessionId: null, stripePaymentIntentId: null });
  });

  it("refuses other people's cases", async () => {
    const bobsCase = await newCase(bob.id);
    currentUser = alice;
    expect((await simulatePOST(json({ caseId: bobsCase.id }))).status).toBe(404);
    expect(await hasCasePass(bobsCase.id)).toBe(false);
  });

  it("returns 404 in production and creates nothing — with or without Stripe configured", async () => {
    const kase = await newCase(alice.id);
    currentUser = alice;
    vi.stubEnv("NODE_ENV", "production");
    expect((await simulatePOST(json({ caseId: kase.id }))).status).toBe(404);
    configureStripe();
    vi.stubEnv("BUREAUOS_STRIPE_ALLOW_TEST_MODE", "true");
    expect((await simulatePOST(json({ caseId: kase.id }))).status).toBe(404);
    expect(await hasCasePass(kase.id)).toBe(false);
    expect(await prisma.purchase.count({ where: { caseId: kase.id } })).toBe(0);
  });
});
