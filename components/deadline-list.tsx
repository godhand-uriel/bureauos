"use client";

import { DeadlineCard } from "@/components/deadline-card";
import { sortDeadlines } from "@/lib/plan-engine";
import { useBureauStore } from "@/lib/store";
import type { Case, Deadline } from "@/lib/types";

const GROUPS: { kind: Deadline["kind"]; heading: string; blurb: string }[] = [
  {
    kind: "official",
    heading: "Official deadlines",
    blurb:
      "Calculated only from a rule checked against the cited source and a date you provided. Anything Building202 could not establish says NEEDS VERIFICATION — it is never estimated.",
  },
  {
    kind: "self_reported",
    heading: "Dates from your notices",
    blurb: "Dates you entered yourself. Double-check them against the paperwork.",
  },
  {
    kind: "suggested",
    heading: "Suggested follow-ups",
    blurb: "Targets to keep things moving. These are not legal deadlines.",
  },
];

/**
 * A case's tracked dates, grouped so a suggested follow-up can never be
 * mistaken for a statutory deadline.
 */
export function DeadlineList({ kase, compact }: { kase: Case; compact?: boolean }) {
  const toggleDeadlineVerified = useBureauStore((s) => s.toggleDeadlineVerified);
  const setTriggerDate = useBureauStore((s) => s.setTriggerDate);

  if (kase.deadlines.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No dates are being tracked for this case.</p>;
  }

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const items = sortDeadlines(kase.deadlines.filter((d) => d.kind === group.kind));
        if (items.length === 0) return null;
        return (
          <section key={group.kind} className="space-y-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </h3>
              {!compact && <p className="mt-0.5 text-xs text-muted-foreground">{group.blurb}</p>}
            </div>
            {items.map((d) => (
              <DeadlineCard
                key={d.id}
                deadline={d}
                compact={compact}
                onToggleVerified={() => toggleDeadlineVerified(kase.id, d.id)}
                onSetTrigger={(questionId, date) => setTriggerDate(kase.id, questionId, date)}
              />
            ))}
          </section>
        );
      })}
      <p className="text-xs leading-relaxed text-muted-foreground">
        The date printed on your official notice always controls. Verify every deadline with the
        agency, plan, or a qualified professional before relying on it.
      </p>
    </div>
  );
}
