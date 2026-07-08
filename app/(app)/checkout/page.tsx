"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Check, CreditCard, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/callout";
import { SERVICE_TIERS, getTier } from "@/lib/packages";
import { useBureauStore, useCase } from "@/lib/store";
import type { ServiceTierId } from "@/lib/types";

function isTierId(v: string | null): v is ServiceTierId {
  return SERVICE_TIERS.some((t) => t.id === v);
}

function CheckoutForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSubscriptionTier = useBureauStore((s) => s.setSubscriptionTier);
  const setCaseServiceTier = useBureauStore((s) => s.setCaseServiceTier);

  const planParam = params.get("plan");
  const caseId = params.get("case");
  const kase = useCase(caseId ?? "");
  const [tierId, setTierId] = useState<ServiceTierId>(isTierId(planParam) ? planParam : "assisted_review");
  const tier = getTier(tierId);
  const [cardName, setCardName] = useState("");
  const [done, setDone] = useState(false);

  const complete = () => {
    setSubscriptionTier(tierId);
    if (kase) setCaseServiceTier(kase.id, tierId);
    setDone(true);
    setTimeout(() => router.push(kase ? `/cases/${kase.id}` : "/billing"), 1200);
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center pt-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
          <BadgeCheck className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="mt-5 text-xl font-bold">You&apos;re on {tier.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Simulated checkout complete — no real charge was made. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-muted-foreground">
          {kase ? `Upgrading service for “${kase.title}”.` : "Choose your service package."}
        </p>
      </div>

      <Callout variant="warning" title="Simulated checkout">
        Payments are not live in this MVP. Completing this flow records a local subscription and a
        mock billing entry — no card is charged and no card data is stored. The flow is shaped for
        Stripe Checkout + webhooks (see README → Payments).
      </Callout>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Your plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {SERVICE_TIERS.filter((t) => t.priceMonthly > 0).map((t) => (
              <button
                key={t.id}
                onClick={() => setTierId(t.id)}
                className={`w-full rounded-lg border p-3.5 text-left transition-colors ${
                  tierId === t.id ? "border-primary/60 bg-primary/10" : "border-border bg-card/50 hover:border-primary/30"
                }`}
                aria-pressed={tierId === t.id}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-sm font-bold">{t.priceLabel}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.tagline}</p>
              </button>
            ))}
            <Link href="/pricing" className="block pt-1 text-center text-xs text-primary hover:underline">
              Compare all plans
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              Payment details
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-medium text-amber-400">
                <FlaskConical className="h-3 w-3" />
                Simulation
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="card-name">Name on card</Label>
              <Input id="card-name" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Jordan Avery" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-number">Card number</Label>
              <Input id="card-number" value="4242 4242 4242 4242" readOnly className="text-muted-foreground" aria-describedby="card-note" />
              <p id="card-note" className="text-xs text-muted-foreground">
                Test card, read-only — real card entry is handled by Stripe in production.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="card-exp">Expiry</Label>
                <Input id="card-exp" value="12/29" readOnly className="text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-cvc">CVC</Label>
                <Input id="card-cvc" value="424" readOnly className="text-muted-foreground" />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{tier.name} — monthly</span>
                <span className="font-semibold">{tier.priceLabel}</span>
              </div>
              <ul className="mt-3 space-y-1">
                {tier.included.slice(0, 3).map((i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>

            <Button className="w-full" size="lg" onClick={complete}>
              Complete simulated checkout — {tier.priceLabel}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No real payment occurs. You can switch back to the free plan any time from Billing.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}
