import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { subscriptionInclude, subscriptionToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { billingInputSchema } from "@/lib/schemas";
import { getTier } from "@/lib/packages";

/**
 * SIMULATED billing — a development/demo mock only. Sets the user's plan and
 * records a mock billing entry so local demos can exercise tier-gated flows.
 *
 * Refused in production: plan/tier state is a paid entitlement, and
 * entitlements may only come from verified payment state (Stripe webhook) or
 * an audited staff override — never from a customer-callable simulation.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Plan changes are not available. Paid packages are not yet offered." },
      { status: 503 },
    );
  }
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = billingInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const tierDef = getTier(parsed.data.tier);

  const payment = {
    label: `${tierDef.name} — ${tierDef.priceMonthly > 0 ? "monthly (simulated)" : "free plan"}`,
    amountLabel: `$${tierDef.priceMonthly.toFixed(2)}`,
    kind: tierDef.priceMonthly > 0 ? "mock_charge" : "plan_change",
  };

  const subscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tier: tierDef.id, status: "active", payments: { create: payment } },
    update: { tier: tierDef.id, status: "active", payments: { create: payment } },
    include: subscriptionInclude,
  });

  const notifications = await queueNotification(
    user.id,
    "billing_update",
    `Plan updated: ${tierDef.name}`,
    "Your BureauOS service package was updated (simulated checkout — no real charge).",
  );

  return NextResponse.json({ subscription: subscriptionToDomain(subscription), notifications });
}

/** Cancel the paid plan and revert to Self-Service (dev/demo simulation only). */
export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Plan changes are not available." }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const subscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tier: "self_service", status: "canceled" },
    update: {
      tier: "self_service",
      status: "canceled",
      payments: {
        create: { label: "Paid plan canceled — reverted to Self-Service", amountLabel: "$0.00", kind: "plan_change" },
      },
    },
    include: subscriptionInclude,
  });
  return NextResponse.json({ subscription: subscriptionToDomain(subscription), notifications: [] });
}
