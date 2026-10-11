/**
 * Calendar-date ("date-only") arithmetic.
 *
 * Legal and agency deadlines are calendar dates, not instants. Running them
 * through `new Date("2026-08-01")` parses as UTC midnight, which is July 31
 * in every US time zone — an off-by-one on exactly the dates that matter.
 * Everything here works on `YYYY-MM-DD` strings and UTC components only, so
 * the result is identical on any server or browser, in any time zone, on
 * either side of a daylight-saving change.
 */

export type DateOnly = string; // "YYYY-MM-DD"

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(input: unknown): { y: number; m: number; d: number } | null {
  if (typeof input !== "string") return null;
  const match = DATE_ONLY.exec(input.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (y < 1900 || y > 2200) return null;
  // Round-trip through UTC to reject impossible dates (Feb 30, month 13, …).
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

export function isDateOnly(input: unknown): input is DateOnly {
  return parseDateOnly(input) !== null;
}

function fromUtc(date: Date): DateOnly {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `date` plus `days` calendar days. Throws on an invalid date — callers validate first. */
export function addDays(date: DateOnly, days: number): DateOnly {
  const p = parseDateOnly(date);
  if (!p) throw new Error(`Invalid calendar date: ${String(date)}`);
  return fromUtc(new Date(Date.UTC(p.y, p.m - 1, p.d + days)));
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: DateOnly, to: DateOnly): number {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) throw new Error("Invalid calendar date");
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0; // ISO dates sort lexicographically
}

export function laterOf(a: DateOnly, b: DateOnly): DateOnly {
  return compareDateOnly(a, b) >= 0 ? a : b;
}

/** Today's calendar date in UTC — used server-side for suggested targets only. */
export function todayUtc(now: Date = new Date()): DateOnly {
  return fromUtc(now);
}

/** Today's calendar date where the code is running (the browser, for display). */
export function todayLocal(now: Date = new Date()): DateOnly {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Database storage: a calendar date is kept at 12:00 UTC so no zone can shift its day. */
export function dateOnlyToUtcNoon(date: DateOnly): Date {
  const p = parseDateOnly(date);
  if (!p) throw new Error(`Invalid calendar date: ${String(date)}`);
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12));
}

export function dateOnlyFromStored(stored: Date): DateOnly {
  return fromUtc(stored);
}

/** Display a calendar date without any time-zone conversion. */
export function formatDateOnly(date: DateOnly | null | undefined): string {
  const p = parseDateOnly(date);
  if (!p) return "—";
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Days from the viewer's today until `date` (negative = past). */
export function daysFromToday(date: DateOnly, today: DateOnly = todayLocal()): number {
  return diffDays(today, date);
}

export function relativeDay(date: DateOnly, today: DateOnly = todayLocal()): string {
  const days = daysFromToday(date, today);
  if (days < 0) return `${Math.abs(days)}d past`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}
