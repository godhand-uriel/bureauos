import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicShell } from "@/components/public-shell";
import { capabilities } from "@/lib/server/commerce";
import { CASE_PASS_EXCLUDES, CASE_PASS_INCLUDES, CASE_PASS_NAME, FREE_INCLUDES, formatPrice } from "@/lib/launch";

export const metadata: Metadata = { title: "Pricing" };

// The price is server configuration, read at request time — never a build-time constant.
export const dynamic = "force-dynamic";

export default function PricingPage() {
  const caps = capabilities();
  const price = formatPrice(caps.casePass.priceCents, caps.casePass.currency);

  return (
    <PublicShell>
      <section className="container py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Free to organize your case. {price} if you want the letters.
          </h1>
          <p className="mt-4 text-muted-foreground">
            BureauOS is self-service software. The plan, deadline tracking, and checklists are free.
            The only thing for sale is the Job Separation Case Pass — a one-time purchase for one
            case. No subscription.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          <Card className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-4 p-6">
              <div>
                <h2 className="font-semibold">Free</h2>
                <p className="mt-2 text-3xl font-bold tracking-tight">$0</p>
                <p className="mt-2 text-sm text-muted-foreground">Every case, every navigator.</p>
              </div>
              <ul className="flex-1 space-y-2">
                {FREE_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full" variant="outline">
                  Create a free account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="relative flex flex-col border-primary/50 shadow-lg shadow-primary/5">
            <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Job Separation</Badge>
            <CardContent className="flex flex-1 flex-col gap-4 p-6">
              <div>
                <h2 className="font-semibold">{CASE_PASS_NAME}</h2>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {price} <span className="text-sm font-normal text-muted-foreground">one time, per case</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Everything in Free, plus:</p>
              </div>
              <ul className="flex-1 space-y-2">
                {CASE_PASS_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
                {CASE_PASS_EXCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground/60">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    Not included: {item.charAt(0).toLowerCase() + item.slice(1)}
                  </li>
                ))}
              </ul>
              <Link href="/signup?next=%2Fcases%2Fnew%3Fnavigator%3Djob-separation" className="block">
                <Button className="w-full">
                  Start a Job Separation case
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                {caps.payments === "off"
                  ? "Purchases aren't available yet. Starting a case is free."
                  : "Start free. You decide about the Case Pass once you've seen your plan."}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-3 text-center text-xs leading-relaxed text-muted-foreground">
          <p>
            Deadline calculations in the Job Separation Navigator are currently available for
            Florida. In other states the organizing tools work the same, and state deadlines are
            shown as needing verification rather than calculated.
          </p>
          <p>
            Human review of your case, document preparation, and other staffed services are not
            currently offered.
          </p>
          <p>
            BureauOS is not a law firm and does not provide legal advice or representation. Nothing
            here guarantees benefits, an appeal result, or any other outcome. Refund terms are in the{" "}
            <Link href="/legal/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
