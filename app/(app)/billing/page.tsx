"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, CreditCard, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { EmptyState } from "@/components/empty-state";
import { CASE_PASS, CASE_PASS_NAME, formatPrice, isPaidNavigator } from "@/lib/launch";
import { useBureauStore, useCapabilities, useHydrated, useMyCases, useMyPurchases } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { PurchaseStatus } from "@/lib/types";

const STATUS: Record<PurchaseStatus, { label: string; variant: "success" | "warning" | "secondary" | "destructive" | "info" }> = {
  pending: { label: "Awaiting payment", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Payment failed", variant: "destructive" },
  expired: { label: "Not completed", variant: "secondary" },
  refunded: { label: "Refunded", variant: "info" },
  disputed: { label: "Disputed — access paused", variant: "destructive" },
  dispute_lost: { label: "Dispute closed", variant: "secondary" },
};

export default function BillingPage() {
  const hydrated = useHydrated();
  const caps = useCapabilities();
  const purchases = useMyPurchases();
  const myCases = useMyCases();
  const entitlements = useBureauStore((s) => s.entitlements);
  const sessionUserId = useBureauStore((s) => s.sessionUserId);

  if (!hydrated || !caps) return <div className="h-64 animate-pulse rounded-lg bg-secondary" />;

  const caseTitle = (id: string | null) => myCases.find((c) => c.id === id)?.title ?? "Deleted case";
  const activePasses = entitlements.filter(
    (e) => e.userId === sessionUserId && e.product === CASE_PASS && e.status === "active",
  );
  const eligible = myCases.filter(
    (c) => isPaidNavigator(c.navigatorSlug) && !activePasses.some((e) => e.caseId === c.id),
  );
  // Abandoned checkouts aren't billing history; show what was paid or needs attention.
  const history = purchases.filter((p) => p.status !== "expired");
  const price = formatPrice(caps.casePass.priceCents, caps.casePass.currency);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Building202 is free to use. The only purchase is the optional {CASE_PASS_NAME}: {price}, one
          time, per case. There are no subscriptions.
        </p>
      </div>

      {caps.payments === "test" && (
        <Callout variant="warning" title="Stripe test mode">
          This environment uses Stripe in test mode — purchases here are not real charges.
        </Callout>
      )}
      {caps.payments === "off" && (
        <Callout variant="info" title="Purchases aren't available right now">
          Payment processing isn&apos;t set up in this environment. Free features are unaffected.
        </Callout>
      )}

      {/* Active Case Passes */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Case Passes
          </CardTitle>
          <CardDescription>A Case Pass unlocks the letter generator on one case.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {activePasses.length === 0 && eligible.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No Case Passes yet. They apply to Job Separation cases —{" "}
              <Link href="/cases/new?navigator=job-separation" className="text-primary underline underline-offset-2">
                start one
              </Link>{" "}
              for free.
            </p>
          )}
          {activePasses.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{caseTitle(e.caseId)}</p>
                <p className="text-xs text-muted-foreground">
                  Active since {formatDate(e.grantedAt)}
                  {e.source === "staff_grant" && " · granted by Building202 staff"}
                  {e.source === "dev_simulation" && " · development simulation (no payment)"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success">Active</Badge>
                <Link href={`/cases/${e.caseId}/letters`}>
                  <Button size="sm" variant="outline">Letters</Button>
                </Link>
              </div>
            </div>
          ))}
          {eligible.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">No Case Pass — letters are locked on this case.</p>
              </div>
              <Link href={`/checkout?case=${c.id}`}>
                <Button size="sm" variant="outline">
                  Case Pass — {price}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Purchase history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            Purchase history
          </CardTitle>
          <CardDescription>
            Payments are processed by Stripe, which emails the receipt to your account address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={CreditCard} title="No purchases" description="Purchases you make will be listed here with their status." />
          ) : (
            <ul className="divide-y divide-border">
              {history.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {CASE_PASS_NAME} <span className="font-normal text-muted-foreground">· {caseTitle(p.caseId)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.createdAt)}
                      {!p.livemode && " · test / simulation — no real charge"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS[p.status].variant} className="text-[10px]">{STATUS[p.status].label}</Badge>
                    <span className="text-sm font-semibold">{formatPrice(p.amountCents, p.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Questions about a charge, or want to request a refund? Open a{" "}
        <Link href="/support/new" className="text-primary underline underline-offset-2">support ticket</Link>{" "}
        in the Billing category. Refund terms are in the{" "}
        <Link href="/legal/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>.
      </p>
    </div>
  );
}
