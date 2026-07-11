import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { subscriptionInclude, subscriptionToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { billingInputSchema } from "@/lib/schemas";
import { getTier } from "@/lib/packages";

/**
 * SIMULATED billing — no payment processor is wired. Sets the user's plan and
 * records a mock billing entry. Stripe Checkout + verified webhooks replace
 * this route in production.
 */
export async function POST(request: Request) {
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

/** Cancel the paid plan and revert to Self-Service. */
export async function DELETE() {
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
