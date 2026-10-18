import { addDays, parseDateOnly, type DateOnly } from "@/lib/dates";

/**
 * Non-business days for Florida Reemployment Assistance appeal deadlines.
 *
 * Fla. Admin. Code R. 73B-20.005(1) (effective 2/15/2023): if the last day of
 * the appeal period is a Saturday, Sunday, or "holiday", the period runs to
 * the end of the next day that is none of those. "Holiday" means:
 *   (a) the dates designated by Fla. Stat. § 110.117,
 *   (b) any other day FloridaCommerce offices are closed,
 *   (c) any other day the U.S. Postal Service is closed, and
 *   (d) any day covered by a judicial order granting relief from deadlines
 *       for the appellant's area (Fla. R. Gen. Prac. & Jud. Admin. 2.205).
 *
 * This module implements (a) and (c) — the closures that are fixed in
 * advance. (b) and (d) are announced case by case (storms, emergencies) and
 * cannot be calculated; leaving them out can only make a calculated deadline
 * EARLIER than the real one, never later, and the caveat on the rule says so.
 *
 * (a) § 110.117 (2025): New Year's Day; Martin Luther King Jr.'s Birthday
 *     (third Monday in January); Memorial Day; Independence Day; Labor Day;
 *     Veterans' Day (November 11); Thanksgiving Day; the Friday after
 *     Thanksgiving; Christmas Day. A holiday on Saturday is observed the
 *     preceding Friday; on Sunday, the following Monday.
 * (c) Postal closures: the legal public holidays of 5 U.S.C. § 6103(a). USPS
 *     closes on the holiday itself; when it falls on a Sunday, post offices
 *     close the following Monday (USPS national release, Dec. 1, 2022); when
 *     it falls on a Saturday they close that Saturday and are open the
 *     preceding Friday (USPS national release, Dec. 1, 2021). Of these, only
 *     Washington's Birthday, Juneteenth and Columbus Day are not already
 *     state holidays.
 */

function ymd(y: number, m: number, d: number): DateOnly {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: DateOnly): number {
  const p = parseDateOnly(date);
  if (!p) throw new Error(`Invalid calendar date: ${String(date)}`);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function isWeekend(date: DateOnly): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** The nth (1-based) given weekday of a month. */
function nthWeekday(y: number, m: number, wd: number, n: number): DateOnly {
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return ymd(y, m, 1 + ((wd - firstDow + 7) % 7) + 7 * (n - 1));
}

/** The last given weekday of a month. */
function lastWeekday(y: number, m: number, wd: number): DateOnly {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return ymd(y, m, lastDay - ((lastDow - wd + 7) % 7));
}

type HolidayList = Map<DateOnly, string>;

function add(list: HolidayList, date: DateOnly, name: string) {
  list.set(date, list.has(date) ? `${list.get(date)}; ${name}` : name);
}

/** § 110.117 observed dates for one calendar year's holidays. */
function floridaStateHolidays(y: number): HolidayList {
  const list: HolidayList = new Map();
  const fixed = (date: DateOnly, name: string) => {
    const w = weekday(date);
    if (w === 6) add(list, addDays(date, -1), `${name} (observed)`);
    else if (w === 0) add(list, addDays(date, 1), `${name} (observed)`);
    else add(list, date, name);
  };
  fixed(ymd(y, 1, 1), "New Year's Day");
  add(list, nthWeekday(y, 1, 1, 3), "Martin Luther King Jr.'s Birthday");
  add(list, lastWeekday(y, 5, 1), "Memorial Day");
  fixed(ymd(y, 7, 4), "Independence Day");
  add(list, nthWeekday(y, 9, 1, 1), "Labor Day");
  fixed(ymd(y, 11, 11), "Veterans' Day");
  const thanksgiving = nthWeekday(y, 11, 4, 4);
  add(list, thanksgiving, "Thanksgiving Day");
  add(list, addDays(thanksgiving, 1), "Friday after Thanksgiving");
  fixed(ymd(y, 12, 25), "Christmas Day");
  return list;
}

/** Weekdays the Postal Service is closed for one calendar year's federal holidays. */
function postalClosures(y: number): HolidayList {
  const list: HolidayList = new Map();
  const onDay = (date: DateOnly, name: string) => {
    const w = weekday(date);
    if (w === 0) add(list, addDays(date, 1), `${name} (observed), Postal Service closed`);
    else if (w !== 6) add(list, date, `${name}, Postal Service closed`);
    // Saturday: closed that Saturday only — already a non-business day.
  };
  onDay(ymd(y, 1, 1), "New Year's Day");
  onDay(nthWeekday(y, 1, 1, 3), "Martin Luther King Jr.'s Birthday");
  onDay(nthWeekday(y, 2, 1, 3), "Washington's Birthday");
  onDay(lastWeekday(y, 5, 1), "Memorial Day");
  if (y >= 2021) onDay(ymd(y, 6, 19), "Juneteenth National Independence Day");
  onDay(ymd(y, 7, 4), "Independence Day");
  onDay(nthWeekday(y, 9, 1, 1), "Labor Day");
  onDay(nthWeekday(y, 10, 1, 2), "Columbus Day");
  onDay(ymd(y, 11, 11), "Veterans Day");
  onDay(nthWeekday(y, 11, 4, 4), "Thanksgiving Day");
  onDay(ymd(y, 12, 25), "Christmas Day");
  return list;
}

/**
 * Why `date` is not a filing day for a Florida RA appeal, or null if it is.
 * Checks the date's own year and the next (New Year's Day on a Saturday is
 * observed on December 31 of the year before).
 */
export function floridaRaClosure(date: DateOnly): string | null {
  const w = weekday(date);
  if (w === 6) return "Saturday";
  if (w === 0) return "Sunday";
  const year = parseDateOnly(date)!.y;
  const names: string[] = [];
  for (const y of [year, year + 1]) {
    const state = floridaStateHolidays(y).get(date);
    if (state) names.push(`${state}, a Florida state holiday`);
    const postal = postalClosures(y).get(date);
    if (postal && !state) names.push(postal);
  }
  return names.length ? names.join("; ") : null;
}

/** For tests and display: every weekday closure in a year, sorted. */
export function floridaRaClosuresInYear(y: number): { date: DateOnly; reason: string }[] {
  const out: { date: DateOnly; reason: string }[] = [];
  for (let date = ymd(y, 1, 1); date <= ymd(y, 12, 31); date = addDays(date, 1)) {
    if (isWeekend(date)) continue;
    const reason = floridaRaClosure(date);
    if (reason) out.push({ date, reason });
  }
  return out;
}
