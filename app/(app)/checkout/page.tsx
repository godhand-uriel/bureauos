"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BadgeCheck, Check, FlaskConical, Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { CASE_PASS, CASE_PASS_EXCLUDES, CASE_PASS_INCLUDES, CASE_PASS_NAME, formatPrice, isPaidNavigator } from "@/lib/launch";
import { useBureauStore, useCapabilities, useCase, useHydrated, useMyCases } from "@/lib/store";

/**
 * Case Pass checkout. This page collects no payment details: it asks the
 * server for a Stripe-hosted Checkout session and sends the browser there.
 * The Case Pass is unlocked by Stripe's signed webhook, not by this page.
 */
function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const caps = useCapabilities();
  const caseId = params.get("case") ?? "";
  const canceled = params.get("canceled") === "1";
  const kase = useCase(caseId);
  const myCases = useMyCases();
  const entitlements = useBureauStore((s) => s.entitlements);
  const startCheckout = useBureauStore((s) => s.startCheckout);
  const simulateDevPayment = useBureauStore((s) => s.simulateDevPayment);
  const [busy, setBusy] = useState<"pay" | "simulate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated || !caps) return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;

  const hasPass = (id: string) =>
    entitlements.some((e) => e.caseId === id && e.product === CASE_PASS && e.status === "active");
  const price = formatPrice(caps.casePass.priceCents, caps.casePass.currency);

  // No (valid) case chosen: the Case Pass is bought for one specific case.
  if (!kase || !isPaidNavigator(kase.navigatorSlug)) {
    const eligible = myCases.filter((c) => isPaidNavigator(c.navigatorSlug) && !hasPass(c.id));
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{CASE_PASS_NAME}</h1>
          <p className="mt-1 text-muted-foreground">
            {price}, one time, for one Job Separation case. Choose the case it&apos;s for.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-3 p-6">
            {eligible.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have a Job Separation case that needs a Case Pass. Start one — the
                  intake, plan, and deadline tracking are free.
                </p>
                <Link href="/cases/new?navigator=job-separation" className="inline-block">
                  <Button>
                    Start a Job Separation case
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              eligible.map((c) => (
                <Link
                  key={c.id}
                  href={`/checkout?case=${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4 text-sm transition-colors hover:border-primary/40"
                >
                  <span className="font-medium">{c.title}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasPass(kase.id)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center pt-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
          <BadgeCheck className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="mt-5 text-xl font-bold">This case already has a Case Pass</h1>
        <p className="mt-2 text-sm text-muted-foreground">The letter generator is unlocked for “{kase.title}”.</p>
        <Link href={`/cases/${kase.id}/letters`} className="mt-6">
          <Button>
            Open letters
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const pay = async () => {
    setBusy("pay");
    setError(null);
    const result = await startCheckout(kase.id);
    if (!result.ok) {
      setBusy(null);
      setError(result.error);
      return;
    }
    // Leave for Stripe-hosted Checkout. Card details are entered there, never here.
    window.location.assign(result.url);
  };

  const simulate = async () => {
    setBusy("simulate");
    setError(null);
    const result = await simulateDevPayment(kase.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/cases/${kase.id}/letters`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-muted-foreground">
          {CASE_PASS_NAME} for “{kase.title}”.
        </p>
      </div>

      {canceled && (
        <Callout variant="info" title="Checkout canceled">
          No payment was made. You can try again whenever you&apos;re ready.
        </Callout>
      )}

      {caps.payments === "test" && (
        <Callout variant="warning" title="Stripe test mode">
          This environment is connected to Stripe in test mode. No real money moves, and only
          Stripe&apos;s test cards work.
        </Callout>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline justify-between gap-3 text-base">
            <span>{CASE_PASS_NAME}</span>
            <span className="text-xl font-bold">{price}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">One-time payment for this case. Not a subscription.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Includes</p>
              <ul className="mt-2 space-y-1.5">
                {CASE_PASS_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Does not include</p>
              <ul className="mt-2 space-y-1.5">
                {CASE_PASS_EXCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {caps.payments === "off" ? (
            <Callout variant="info" title="Purchases aren't available right now">
              Payment processing isn&apos;t set up in this environment, so nothing can be bought here.
              Your plan, deadlines, checklists, and timeline are free and keep working.
            </Callout>
          ) : (
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={pay} disabled={busy !== null}>
                {busy === "pay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Continue to secure payment — {price}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                You&apos;ll pay on a page hosted by Stripe. Building202 never sees or stores your card
                details. By purchasing you agree to the{" "}
                <Link href="/legal/terms" target="_blank" className="text-primary underline underline-offset-2">
                  Terms of Service
                </Link>
                , including the refund terms.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {caps.devTools && (
        <Card className="border-amber-500/30">
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <FlaskConical className="h-4 w-4" />
              Development tools — not available in production
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Unlocks the Case Pass on this case without Stripe so the paid experience can be
              exercised locally. Recorded as a simulation, never as a payment.
            </p>
            <Button variant="outline" size="sm" onClick={simulate} disabled={busy !== null}>
              {busy === "simulate" && <Loader2 className="h-4 w-4 animate-spin" />}
              Simulate a completed payment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
