"use client";

import { CalendarClock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, daysUntil, formatDate, relativeDeadline } from "@/lib/utils";
import type { Deadline } from "@/lib/types";

interface DeadlineCardProps {
  deadline: Deadline;
  caseTitle?: string;
  onToggleVerified?: () => void;
}

export function DeadlineCard({ deadline, caseTitle, onToggleVerified }: DeadlineCardProps) {
  const days = daysUntil(deadline.date);
  const urgency = deadline.verified
    ? "done"
    : days < 0
      ? "overdue"
      : days <= 7
        ? "soon"
        : "future";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3.5",
        urgency === "overdue" && "border-red-500/40 bg-red-500/5",
        urgency === "soon" && "border-amber-500/40 bg-amber-500/5",
        urgency === "future" && "border-border bg-card/50",
        urgency === "done" && "border-border bg-card/50 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          urgency === "overdue" && "bg-red-500/15 text-red-400",
          urgency === "soon" && "bg-amber-500/15 text-amber-400",
          urgency === "future" && "bg-secondary text-muted-foreground",
          urgency === "done" && "bg-emerald-500/15 text-emerald-400",
        )}
      >
        {urgency === "done" ? <CheckCircle2 className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium leading-snug">{deadline.title}</p>
          <Badge
            variant={urgency === "overdue" ? "destructive" : urgency === "soon" ? "warning" : "secondary"}
            className="text-[10px]"
          >
            {relativeDeadline(deadline.date)}
          </Badge>
        </div>
        {caseTitle && <p className="mt-0.5 text-xs text-muted-foreground">{caseTitle}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(deadline.date)}</p>
        {deadline.note && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{deadline.note}</p>
        )}
      </div>
      {onToggleVerified && (
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <Checkbox
            checked={deadline.verified}
            onCheckedChange={onToggleVerified}
            aria-label={`Mark "${deadline.title}" as verified`}
          />
          <span className="text-[10px] text-muted-foreground">Verified</span>
        </div>
      )}
    </div>
  );
}
