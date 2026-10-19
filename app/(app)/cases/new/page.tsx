"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NavigatorIcon } from "@/components/navigator-icon";
import { NAVIGATORS, isNavigatorSlug } from "@/lib/navigators";
import { useBureauStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NavigatorSlug } from "@/lib/types";

function NewCaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createCase = useBureauStore((s) => s.createCase);

  const paramSlug = searchParams.get("navigator");
  const [slug, setSlug] = useState<NavigatorSlug | null>(
    paramSlug && isNavigatorSlug(paramSlug) ? paramSlug : null,
  );
  const [title, setTitle] = useState("");

  const selected = NAVIGATORS.find((n) => n.slug === slug);

  const handleCreate = async () => {
    if (!slug) return;
    const kase = await createCase(slug, title);
    if (kase) router.push(`/cases/${kase.id}/intake`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Start a new case</h1>
        <p className="mt-1 text-muted-foreground">
          Pick the navigator that matches your situation, give the case a name, and begin intake.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">1. Choose a navigator</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {NAVIGATORS.map((nav) => (
            <button
              key={nav.slug}
              type="button"
              onClick={() => setSlug(nav.slug)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3.5 text-left transition-colors",
                slug === nav.slug
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card/50 hover:border-primary/30",
              )}
              aria-pressed={slug === nav.slug}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `hsl(${nav.accent} / 0.15)`, color: `hsl(${nav.accent})` }}
              >
                <NavigatorIcon icon={nav.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {nav.shortName}
                  {nav.launchStatus !== "live" && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                      Preview
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{nav.tagline}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="case-title" className="text-sm font-semibold">
          2. Name your case <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="case-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            selected
              ? `e.g. "${selected.slug === "tenant-rights" ? "Kitchen sink leak — Unit 2A" : selected.slug === "dmv" ? "License reinstatement" : `${selected.shortName} — ${new Date().getFullYear()}`}"`
              : "Pick a navigator first"
          }
        />
        <p className="text-xs text-muted-foreground">
          A short, specific name helps when you have several cases going.
        </p>
      </div>

      <Card className={cn(!selected && "opacity-50")}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {selected ? `Ready: ${selected.name}` : "Select a navigator to continue"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selected
                ? selected.launchStatus === "live"
                  ? `Next: up to ${selected.questions.length} intake questions (~5 minutes, progress saves as you go). Starting a case is free.`
                  : `Preview navigator: general organizing tools, no verified deadline rules. Next: up to ${selected.questions.length} intake questions.`
                : "Starting a case is free. Your case is saved to your account."}
            </p>
          </div>
          <Button onClick={handleCreate} disabled={!slug} size="lg" className="shrink-0">
            Create case & start intake
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewCasePage() {
  return (
    <Suspense>
      <NewCaseForm />
    </Suspense>
  );
}
