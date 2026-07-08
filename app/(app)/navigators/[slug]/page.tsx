import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleAlert, ClipboardList, FilePen, FileText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/callout";
import { NavigatorIcon } from "@/components/navigator-icon";
import { NAVIGATORS, getNavigator } from "@/lib/navigators";

export function generateStaticParams() {
  return NAVIGATORS.map((n) => ({ slug: n.slug }));
}

export default async function NavigatorOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const nav = getNavigator(slug);
  if (!nav) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `hsl(${nav.accent} / 0.15)`, color: `hsl(${nav.accent})` }}
        >
          <NavigatorIcon icon={nav.icon} className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{nav.name}</h1>
          <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">{nav.description}</p>
          <Link href={`/cases/new?navigator=${nav.slug}`} className="mt-5 inline-block">
            <Button size="lg">
              Start a {nav.shortName} case
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* What it handles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleAlert className="h-4 w-4 text-primary" />
            Problems this navigator handles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {nav.problems.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `hsl(${nav.accent})` }}
                />
                {p}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* What you get */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">Guided intake</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {nav.questions.length} plain-language questions that capture your situation. Progress saves automatically.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ListChecks className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">Action plan & checklists</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Personalized next steps, a {nav.baseDocuments.length}-item document checklist, task tracking, and deadline flags.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <FilePen className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">Letter generator</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {nav.letterTemplates.map((t) => t.name).join(", ")} — editable before you send.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Documents you&apos;ll likely need
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {nav.baseDocuments.map((d) => (
              <li key={d.name} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {d.name}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Callout variant="info" title="A note on what BureauOS is">
        {nav.disclaimer}
      </Callout>
    </div>
  );
}
