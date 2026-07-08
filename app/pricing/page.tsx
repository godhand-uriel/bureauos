import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicShell } from "@/components/public-shell";
import { SERVICE_TIERS } from "@/lib/packages";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="container py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Self-service is free. Human help when you want it.
          </h1>
          <p className="mt-4 text-muted-foreground">
            Every plan includes all six navigators, action plans, letters, and deadline tracking.
            Paid plans add BureauOS team review and hands-on support.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Demo note: checkout is simulated in this MVP — no real charges. Stripe integration is
            documented and ready to wire in.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SERVICE_TIERS.map((tier) => (
            <Card
              key={tier.id}
              className={cn("relative flex flex-col", tier.highlight && "border-primary/50 shadow-lg shadow-primary/5")}
            >
              {tier.highlight && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Most popular</Badge>
              )}
              <CardContent className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <h2 className="font-semibold">{tier.name}</h2>
                  <p className="mt-2 text-3xl font-bold tracking-tight">{tier.priceLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{tier.tagline}</p>
                </div>
                <ul className="flex-1 space-y-2">
                  {tier.included.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                  {tier.notIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                      <X className="mt-0.5 h-4 w-4 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={tier.priceMonthly === 0 ? "/signup" : `/checkout?plan=${tier.id}`} className="block">
                  <Button className="w-full" variant={tier.highlight ? "default" : "outline"}>
                    {tier.priceMonthly === 0 ? "Start free" : `Choose ${tier.name}`}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          BureauOS is not a law firm and does not provide legal advice. Human-assisted plans provide
          organizational review, document-completeness checks, and preparation support. Professional
          review availability depends on BureauOS operations and qualified professionals.
        </p>
      </section>
    </PublicShell>
  );
}
