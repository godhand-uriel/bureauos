import { prisma } from "@/lib/server/db";
import { queueNotification } from "@/lib/server/notify";
import { appOrigin } from "@/lib/server/commerce";
import { addDays, dateOnlyFromStored, dateOnlyToUtcNoon, diffDays, formatDateOnly, todayUtc } from "@/lib/dates";

/**
 * Deadline reminder emails.
 *
 * Only dated official and self-reported deadlines get reminders — never a
 * Building202 "suggested" target (not a legal deadline) and never one marked
 * NEEDS VERIFICATION (there is no date to count to). A reminder goes out at
 * 7, 3 and 1 days before, and on the day. Each one is queued at most once per
 * deadline, date and threshold (dedupe key), so the runner can call this as
 * often as it likes; if a run is missed, the next run sends the reminder for
 * the closest threshold instead of skipping it.
 *
 * Days are counted on the UTC calendar, which can differ by one day from the
 * customer's own date near midnight — the email says what date it means.
 */
export const REMINDER_THRESHOLDS = [7, 3, 1, 0] as const;

export function reminderThreshold(daysLeft: number): number | null {
  if (daysLeft < 0) return null;
  const fitting = REMINDER_THRESHOLDS.filter((t) => t >= daysLeft);
  return fitting.length ? Math.min(...fitting) : null;
}

export async function queueDeadlineReminders(today = todayUtc()): Promise<number> {
  const deadlines = await prisma.deadline.findMany({
    where: {
      kind: { in: ["official", "self_reported"] },
      date: { gte: dateOnlyToUtcNoon(today), lte: dateOnlyToUtcNoon(addDays(today, 7)) },
      case: { status: { notIn: ["resolved", "closed"] } },
    },
    include: { case: { select: { id: true, title: true, userId: true } } },
  });

  let queued = 0;
  for (const d of deadlines) {
    if (!d.date) continue;
    const date = dateOnlyFromStored(d.date);
    const daysLeft = diffDays(today, date);
    const threshold = reminderThreshold(daysLeft);
    if (threshold === null) continue;

    const when = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    const subject = daysLeft === 0 ? `Due today: ${d.title}` : `Coming up ${when}: ${d.title}`;
    const source =
      d.kind === "official"
        ? "Building202 calculated this date from a date you entered and the rule shown on the deadline. The date printed on your official notice always controls."
        : "This is the date you entered from your own notice or records.";
    const body = [
      `Your case "${d.case.title}" has a deadline ${when}:`,
      "",
      `${d.title} — ${formatDateOnly(date)}`,
      "",
      source,
      "",
      `Open your case: ${appOrigin()}/cases/${d.case.id}`,
    ].join("\n");

    const created = await queueNotification(d.case.userId, "deadline_alert", subject, body, {
      dedupeKey: `deadline:${d.id}:${date}:${threshold}`,
      deliverNow: false, // the runner that called us delivers next
    });
    queued += created.length;
  }
  return queued;
}
