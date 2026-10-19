"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { NavigatorIcon } from "@/components/navigator-icon";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { getNavigator } from "@/lib/navigators";
import { caseProgress, headlineDeadline } from "@/lib/plan-engine";
import { relativeDay } from "@/lib/dates";
import type { Case } from "@/lib/types";

export function CaseCard({ kase }: { kase: Case }) {
  const nav = getNavigator(kase.navigatorSlug);
  const progress = caseProgress(kase);
  const nextDeadline = headlineDeadline(kase.deadlines);

  return (
    <Link href={`/cases/${kase.id}`} className="group block h-full">
      <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: nav ? `hsl(${nav.accent} / 0.15)` : undefined,
                color: nav ? `hsl(${nav.accent})` : undefined,
              }}
            >
              <NavigatorIcon icon={nav?.icon ?? ""} className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <StatusBadge status={kase.status} />
              <PriorityBadge priority={kase.priority} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold leading-snug">{kase.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{nav?.name}</p>
          </div>
          <div className="mt-auto space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
            {nextDeadline && (
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {nextDeadline.title} ·{" "}
                {nextDeadline.date ? relativeDay(nextDeadline.date) : "needs verification"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
