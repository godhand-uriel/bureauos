import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FilePen,
  Landmark,
  ListChecks,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NavigatorIcon } from "@/components/navigator-icon";
import { NAVIGATORS } from "@/lib/navigators";

const HOW_IT_WORKS = [
  {
    icon: Route,
    title: "Pick your navigator",
    text: "Six focused modules for the bureaucratic problems that derail real life — DMV, job loss, insurance denials, veteran benefits, tenant rights, and small business compliance.",
  },
  {
    icon: ClipboardList,
    title: "Answer a guided intake",
    text: "Plain-language questions capture your situation. Progress saves as you go — stop and come back anytime.",
  },
  {
    icon: Sparkles,
    title: "Get an action plan",
    text: "A personalized plan: your next three moves, document checklist, deadlines to verify, and risk flags to watch.",
  },
  {
    icon: FilePen,
    title: "Execute with confidence",
    text: "Track tasks, organize documents, generate formal letters, and keep a dated timeline of everything that happens.",
  },
];

const PILLARS = [
  { icon: ListChecks, title: "Everything in one case file", text: "Tasks, documents, deadlines, letters, and communications — organized per case instead of scattered across notes and inboxes." },
  { icon: CheckCircle2, title: "Built for follow-through", text: "Clear next actions and deadline tracking keep momentum through processes designed to outlast your patience." },
  { icon: ShieldCheck, title: "Honest about what it is", text: "BureauOS organizes information and prepares next steps. It is not a law firm and does not provide legal advice — and it says so." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Bureau<span className="text-primary">OS</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/pricing" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block sm:px-3">
              Pricing
            </Link>
            <Link href="/login" className="px-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:px-3">
              Log in
            </Link>
            <Link href="/dashboard">
              <Button size="sm">
                Open the app
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

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
            Free demo mode — no account required
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Bureaucracy is a system.
            <br />
            <span className="text-primary">Now you have one too.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
            BureauOS turns overwhelming life-admin problems — a suspended license, a denied claim,
            a lost job, an ignored repair request — into organized cases with clear next steps,
            document checklists, and deadlines you won&apos;t miss.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/navigators">
              <Button size="lg">
                Start a case
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                Explore the demo dashboard
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            BureauOS helps you organize information and prepare next steps. It does not provide legal advice.
          </p>
        </div>
      </section>

      {/* Navigators */}
      <section className="container pb-20">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Six navigators. One command center.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Each navigator knows the terrain of one bureaucratic system and walks you through it.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAVIGATORS.map((nav) => (
            <Link key={nav.slug} href={`/navigators/${nav.slug}`} className="group">
              <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `hsl(${nav.accent} / 0.15)`, color: `hsl(${nav.accent})` }}
                  >
                    <NavigatorIcon icon={nav.icon} className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{nav.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{nav.tagline}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card/30">
        <div className="container py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From chaos to case file in minutes</h2>
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

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container flex flex-col items-center py-20 text-center">
          <h2 className="max-w-xl text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            The paperwork isn&apos;t going to organize itself.
          </h2>
          <Link href="/navigators" className="mt-8">
            <Button size="lg">
              Start your first case
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} BureauOS. Demo MVP.</p>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          </nav>
          <p className="max-w-sm text-center text-xs sm:text-right">
            BureauOS organizes information, options, and next steps. It is not a substitute for
            legal, tax, or financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
