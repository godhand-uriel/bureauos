"use client";

import Link from "next/link";
import { ArrowUpRight, CreditCard, Receipt, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { EmptyState } from "@/components/empty-state";
import { TierBadge } from "@/components/platform-badges";
import { SERVICE_TIERS, getTier, tierRank } from "@/lib/packages";
import { useBureauStore, useHydrated, useMySubscription } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export default function BillingPage() {
  const hydrated = useHydrated();
  const subscription = useMySubscription();
  const cancelSubscription = useBureauStore((s) => s.cancelSubscription);

  if (!hydrated) return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;

  const tier = getTier(subscription?.tier ?? "self_service");
  const isPaid = tier.priceMonthly > 0 && subscription?.status === "active";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Your service package and billing history.
        </p>
      </div>

      <Callout variant="info" title="Simulated billing">
        Payments are mocked in this MVP — plan changes are recorded locally and no card is ever
        charged. The subscription model is Stripe-shaped for a real integration later.
      </Callout>

      {/* Current plan */}
      <Card className="border-primary/30">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Current plan
          </CardTitle>
          <TierBadge tier={tier.id} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold">{tier.priceLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>
            </div>
            <div className="flex items-center gap-2">
              {subscription && (
                <Badge variant={subscription.status === "active" ? "success" : "secondary"}>
                  {subscription.status === "active" ? "Active" : "Canceled"}
                </Badge>
              )}
              {subscription && (
                <span className="text-xs text-muted-foreground">
                  since {formatDate(subscription.startedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SERVICE_TIERS.filter((t) => t.id !== tier.id).map((t) => (
              <Link key={t.id} href={t.priceMonthly === 0 ? "#" : `/checkout?plan=${t.id}`}>
                {t.priceMonthly === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm("Switch to the free Self-Service plan?")) cancelSubscription();
                    }}
                  >
                    Downgrade to {t.name}
                  </Button>
                ) : (
                  <Button variant={tierRank(t.id) > tierRank(tier.id) ? "default" : "outline"} size="sm">
                    {tierRank(t.id) > tierRank(tier.id) ? "Upgrade" : "Switch"} to {t.name}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </Link>
            ))}
          </div>
          {isPaid && (
            <p className="text-xs text-muted-foreground">
              Downgrading to Self-Service keeps all your cases and data — you just lose human-assisted
              review going forward.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Billing history
          </CardTitle>
          <CardDescription>Simulated entries — real invoices come from Stripe in production.</CardDescription>
        </CardHeader>
        <CardContent>
          {!subscription || subscription.history.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No billing activity"
              description="Plan changes and simulated charges will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {[...subscription.history].reverse().map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {entry.kind === "mock_charge" ? "Simulated charge" : entry.kind === "mock_refund" ? "Simulated refund" : "Plan change"}
                    </Badge>
                    <span className="text-sm font-semibold">{entry.amountLabel}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
