"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, CircleHelp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { daysFromToday, formatDateOnly, relativeDay } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

interface DeadlineCardProps {
  deadline: Deadline;
  caseTitle?: string;
  onToggleVerified?: () => void;
  /** Lets the user supply the triggering date for a deadline that needs verification. */
  onSetTrigger?: (questionId: string, date: string) => Promise<{ ok: boolean; error?: string }>;
  /** Dashboard lists: hide the rule details and the date-entry form. */
  compact?: boolean;
}

const KIND_LABEL: Record<Deadline["kind"], string> = {
  official: "Official deadline",
  self_reported: "From your notice",
  suggested: "Suggested follow-up",
};

/**
 * One tracked date. The three kinds are deliberately rendered differently:
 * an official deadline shows its rule, source, and what it was counted from
 * (or NEEDS VERIFICATION when it could not be established); a self-reported
 * date says it came from the user; a suggestion never looks like a deadline.
 */
export function DeadlineCard({ deadline, caseTitle, onToggleVerified, onSetTrigger, compact }: DeadlineCardProps) {
  const [triggerDate, setTriggerDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsVerification = deadline.date === null;
  const days = deadline.date ? daysFromToday(deadline.date) : null;
  const firm = deadline.kind !== "suggested";
  const urgency = needsVerification
    ? "unknown"
    : deadline.verified && !firm
      ? "done"
      : days !== null && days < 0
        ? "past"
        : days !== null && days <= 7 && firm
          ? "soon"
          : "future";

  const submitTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadline.trigger || !onSetTrigger || !triggerDate) return;
    setBusy(true);
    setError(null);
    const result = await onSetTrigger(deadline.trigger.questionId, triggerDate);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not save that date.");
    else setTriggerDate("");
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3.5",
        urgency === "unknown" && "border-amber-500/40 bg-amber-500/5",
        urgency === "past" && firm && "border-red-500/40 bg-red-500/5",
        urgency === "past" && !firm && "border-border bg-card/50 opacity-70",
        urgency === "soon" && "border-amber-500/40 bg-amber-500/5",
        urgency === "future" && "border-border bg-card/50",
        urgency === "done" && "border-border bg-card/50 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          urgency === "unknown" && "bg-amber-500/15 text-amber-400",
          urgency === "past" && firm && "bg-red-500/15 text-red-400",
          urgency === "past" && !firm && "bg-secondary text-muted-foreground",
          urgency === "soon" && "bg-amber-500/15 text-amber-400",
          urgency === "future" && "bg-secondary text-muted-foreground",
          urgency === "done" && "bg-emerald-500/15 text-emerald-400",
        )}
      >
        {urgency === "unknown" ? (
          <CircleHelp className="h-4 w-4" />
        ) : urgency === "done" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <CalendarClock className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium leading-snug">{deadline.title}</p>
          <Badge variant={deadline.kind === "official" ? "default" : "secondary"} className="text-[10px]">
            {KIND_LABEL[deadline.kind]}
          </Badge>
          {needsVerification ? (
            <Badge variant="warning" className="text-[10px] font-semibold tracking-wide">
              NEEDS VERIFICATION
            </Badge>
          ) : (
            <Badge
              variant={urgency === "past" && firm ? "destructive" : urgency === "soon" ? "warning" : "secondary"}
              className="text-[10px]"
            >
              {relativeDay(deadline.date as string)}
            </Badge>
          )}
          {deadline.verified && firm && !needsVerification && (
            <Badge variant="success" className="text-[10px]">Confirmed on notice</Badge>
          )}
        </div>

        {caseTitle && <p className="mt-0.5 text-xs text-muted-foreground">{caseTitle}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {needsVerification ? "No date established" : formatDateOnly(deadline.date)}
          {deadline.source && ` · ${deadline.source.jurisdiction}`}
        </p>
        {deadline.note && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{deadline.note}</p>
        )}

        {!compact && deadline.source && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-primary">Rule and source</summary>
            <div className="mt-1.5 space-y-1.5 leading-relaxed text-muted-foreground">
              <p>{deadline.source.ruleSummary}</p>
              <p>
                <a
                  href={deadline.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                >
                  {deadline.source.citation}
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                · source checked {formatDateOnly(deadline.source.checkedOn)}
              </p>
              <p>{deadline.source.caveats}</p>
            </div>
          </details>
        )}

        {!compact && needsVerification && deadline.trigger && onSetTrigger && (
          <form onSubmit={submitTrigger} className="mt-2.5 space-y-1.5">
            <label htmlFor={`trigger-${deadline.id}`} className="block text-xs font-medium">
              {deadline.trigger.label}
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`trigger-${deadline.id}`}
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                className="h-8 w-44 text-xs"
                required
              />
              <Button type="submit" size="sm" disabled={busy || !triggerDate}>
                Calculate from this date
              </Button>
            </div>
            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>

      {onToggleVerified && !needsVerification && (
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <Checkbox
            checked={deadline.verified}
            onCheckedChange={onToggleVerified}
            aria-label={
              firm
                ? `Confirm "${deadline.title}" matches your official notice`
                : `Mark "${deadline.title}" done`
            }
          />
          <span className="w-12 text-center text-[10px] leading-tight text-muted-foreground">
            {firm ? "Matches notice" : "Done"}
          </span>
        </div>
      )}
    </div>
  );
}
