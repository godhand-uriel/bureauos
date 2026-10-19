import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FilePen,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NavigatorIcon } from "@/components/navigator-icon";
import { PublicShell } from "@/components/public-shell";
import { NAVIGATORS } from "@/lib/navigators";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const START_HREF = "/signup?next=%2Fcases%2Fnew%3Fnavigator%3Djob-separation";

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    title: "Answer a guided intake",
    text: "Plain-language questions about how the job ended, your final pay, health coverage, and unemployment claim. Progress saves as you go.",
  },
  {
    icon: Sparkles,
    title: "Get your action plan",
    text: "Your next steps, a document checklist, and risk flags — built from your answers by fixed rules, not guesswork.",
  },
  {
    icon: CalendarClock,
    title: "Track each deadline separately",
    text: "Unemployment appeals, COBRA, and Marketplace enrollment each run from a different event. Each is tracked on its own, with the rule and its source shown.",
  },
  {
    icon: FilePen,
    title: "Write the letters",
    text: "With the optional Case Pass: final paycheck follow-up, COBRA information request, and unemployment appeal statement, prefilled from your answers.",
  },
];

const PILLARS = [
  {
    icon: CalendarClock,
    title: "No invented dates",
    text: "A deadline is calculated only from a date you give us and a rule checked against its cited source. If either is missing, it says NEEDS VERIFICATION instead of guessing.",
  },
  {
    icon: ListChecks,
    title: "Everything in one case file",
    text: "Tasks, documents, deadlines, letters, and a dated timeline — in one place instead of scattered across notes and inboxes.",
  },
  {
    icon: ShieldCheck,
    title: "Honest about what it is",
    text: "Building202 is self-service software. It is not a law firm, gives no legal advice, files nothing for you, and promises no outcome.",
  },
];

export default function LandingPage() {
  const preview = NAVIGATORS.filter((n) => n.launchStatus !== "live");

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 300px at 50% -50px, hsl(217 91% 60% / 0.15), transparent)",
          }}
          aria-hidden
        />
        <div className="container flex flex-col items-center py-20 text-center lg:py-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Job Separation Navigator — deadline calculations available for Florida
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Lost your job?
            <br />
            <span className="text-primary">Get organized before the deadlines pass.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
            Unemployment, final pay, and health coverage each run on their own clock. Building202 turns
            a job separation into one organized case: a plan, a document checklist, and deadlines
            tracked from the right dates.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={START_HREF}>
              <Button size="lg">
                Start a Job Separation case — free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                See pricing
              </Button>
            </Link>
          </div>
          <p className="mt-6 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Building202 helps you organize information and prepare next steps. It is not a law firm and
            does not provide legal advice.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card/30">
        <div className="container py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How the Job Separation Navigator works</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="container py-20">
        <div className="grid gap-4 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.title}>
              <CardContent className="p-6">
                <p.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Preview navigators */}
      <section className="border-t border-border">
        <div className="container py-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Also in preview</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Five more navigators are available as free organizing tools. They don&apos;t have verified
              deadline rules yet, so every deadline in them is yours to verify.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((nav) => (
              <Card key={nav.slug} className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `hsl(${nav.accent} / 0.15)`, color: `hsl(${nav.accent})` }}
                    >
                      <NavigatorIcon icon={nav.icon} className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary">Preview</Badge>
                  </div>
                  <h3 className="font-semibold">{nav.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{nav.tagline}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container flex flex-col items-center py-20 text-center">
          <h2 className="max-w-xl text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            The paperwork isn&apos;t going to organize itself.
          </h2>
          <Link href={START_HREF} className="mt-8">
            <Button size="lg">
              Start your case — free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
