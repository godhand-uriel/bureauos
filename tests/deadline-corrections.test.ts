import { describe, expect, it } from "vitest";
import { computeRuleDeadline, explainCalculation, getDeadlineRule } from "@/lib/deadline-rules";
import { floridaRaClosure, floridaRaClosuresInYear, isWeekend, weekday } from "@/lib/holidays";
import { generatePlanForCase } from "@/lib/plan-engine";
import { NAVIGATORS } from "@/lib/navigators";
import type { AnswerValue, Case } from "@/lib/types";

/**
 * Regression tests for two deadline corrections:
 *
 *  1. Florida Reemployment Assistance appeals — 20 calendar days after the
 *     determination's distributed date, moved to the next business day when
 *     day 20 is a Saturday, Sunday, or holiday (FloridaCommerce "File an
 *     Appeal"; Fla. Admin. Code R. 73B-20.005(1); holidays per Fla. Stat.
 *     § 110.117 and Postal Service closures for 5 U.S.C. § 6103 holidays).
 *  2. COBRA elections — at least 60 days after the LATER of coverage loss and
 *     the date the notice is provided (26 C.F.R. § 54.4980B-6, Q&A-1), so
 *     both dates are required before anything is calculated.
 *
 * Expected dates were worked out independently from a plain calendar, not
 * read back from the implementation.
 */

const FL = getDeadlineRule("fl-ra-appeal")!;
const COBRA = getDeadlineRule("us-cobra-election")!;

function appeal(distributed: string, today = "2040-01-01") {
  return computeRuleDeadline(FL, { ra_determination_mailed_date: distributed }, today);
}

function cobra(answers: Record<string, AnswerValue>, today = "2040-01-01") {
  return computeRuleDeadline(COBRA, answers, today);
}

/* ------------------------------------------------------------------ */

describe("Florida RA appeal: weekends", () => {
  it("October 5, 2026 → October 26, 2026 (day 20 is Sunday, October 25)", () => {
    const r = appeal("2026-10-05");
    expect(r).toMatchObject({
      status: "calculated",
      countedDate: "2026-10-25",
      date: "2026-10-26",
      skipped: [{ date: "2026-10-25", reason: "Sunday" }],
      basis: { questionId: "ra_determination_mailed_date", date: "2026-10-05" },
    });
    if (r.status === "calculated") {
      const note = explainCalculation(FL, r);
      expect(note).toContain("Sunday");
      expect(note).toContain("next business day");
      expect(note).toContain("2026-10-05");
    }
  });

  it("day 20 on a Saturday moves past the whole weekend", () => {
    expect(appeal("2026-10-04")).toMatchObject({
      countedDate: "2026-10-24",
      date: "2026-10-26",
      skipped: [
        { date: "2026-10-24", reason: "Saturday" },
        { date: "2026-10-25", reason: "Sunday" },
      ],
    });
  });

  it("a weekday that is not a holiday is not moved", () => {
    expect(appeal("2026-10-13")).toMatchObject({ countedDate: "2026-11-02", date: "2026-11-02", skipped: [] });
    expect(appeal("2026-10-06")).toMatchObject({ date: "2026-10-26", skipped: [] }); // a Monday already
  });

  it("counts from the day after the distributed date (20 calendar days, weekends included)", () => {
    // Oct 1, 2026 (Thursday) + 20 = Wednesday, Oct 21 — intervening weekends still count.
    expect(appeal("2026-10-01")).toMatchObject({ date: "2026-10-21", skipped: [] });
  });
});

describe("Florida RA appeal: legal holidays", () => {
  // [distributed date, expected last day, a reason that must appear]
  const CASES: [string, string, RegExp][] = [
    ["2026-11-06", "2026-11-30", /Thanksgiving Day/], // Thu Thanksgiving → Fri after → weekend
    ["2026-12-05", "2026-12-28", /Christmas Day/],
    ["2026-12-12", "2027-01-04", /New Year's Day/],
    ["2026-06-13", "2026-07-06", /Independence Day \(observed\)/], // July 4, 2026 is Saturday → Fri Jul 3
    ["2027-06-15", "2027-07-06", /Independence Day \(observed\)/], // July 4, 2027 is Sunday → Mon Jul 5
    ["2026-10-22", "2026-11-12", /Veterans' Day/],
    ["2026-12-29", "2027-01-19", /Martin Luther King/],
    ["2026-08-18", "2026-09-08", /Labor Day/],
    ["2027-05-11", "2027-06-01", /Memorial Day/],
    ["2027-12-04", "2027-12-27", /Christmas Day \(observed\)/], // Dec 25, 2027 is Saturday → Fri Dec 24
    ["2027-12-11", "2028-01-03", /New Year's Day \(observed\)/], // Jan 1, 2028 is Saturday → Fri Dec 31, 2027
    // Federal holidays that are not Florida state holidays, but close the Postal Service:
    ["2026-09-22", "2026-10-13", /Columbus Day, Postal Service closed/],
    ["2027-01-26", "2027-02-16", /Washington's Birthday, Postal Service closed/],
    ["2026-05-30", "2026-06-22", /Juneteenth.*Postal Service closed/], // Fri Jun 19, 2026 → weekend → Mon
    ["2033-05-31", "2033-06-21", /Juneteenth.*\(observed\), Postal Service closed/], // Jun 19, 2033 is Sunday → Mon Jun 20
  ];

  for (const [distributed, expected, reason] of CASES) {
    it(`${distributed} → ${expected}`, () => {
      const r = appeal(distributed);
      expect(r.status).toBe("calculated");
      if (r.status !== "calculated") return;
      expect(r.date).toBe(expected);
      expect(r.skipped.map((s) => s.reason).join(" | ")).toMatch(reason);
      expect(isWeekend(r.date)).toBe(false);
      expect(floridaRaClosure(r.date)).toBeNull();
    });
  }

  it("Thanksgiving: skips the holiday, the Friday after it, and the weekend", () => {
    const r = appeal("2026-11-06");
    if (r.status !== "calculated") throw new Error("expected a date");
    expect(r.skipped.map((s) => s.date)).toEqual(["2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
    expect(explainCalculation(FL, r)).toContain("the next 3 days are closed too");
  });

  it("does not extend for days that are not holidays under the rule", () => {
    // Juneteenth 2027 is a Saturday: the Postal Service closes that Saturday only,
    // and it is not a Florida state holiday, so Friday, June 18 is a business day.
    expect(appeal("2027-05-29")).toMatchObject({ date: "2027-06-18", skipped: [] });
    // Good Friday (Mar 26, 2027) and Jan 19 are Fla. Stat. § 683.01 "legal holidays",
    // but R. 73B-20.005 uses the § 110.117 list — state offices and post offices are open.
    expect(appeal("2027-03-06")).toMatchObject({ date: "2027-03-26", skipped: [] });
    expect(floridaRaClosure("2027-01-19")).toBeNull();
    // Christmas Eve and New Year's Eve are ordinary business days unless observed.
    expect(floridaRaClosure("2026-12-24")).toBeNull();
    expect(floridaRaClosure("2026-12-31")).toBeNull();
  });

  it("the 2026 closure calendar matches § 110.117 plus Postal Service closures exactly", () => {
    expect(floridaRaClosuresInYear(2026).map((c) => c.date)).toEqual([
      "2026-01-01", // New Year's Day (Thu)
      "2026-01-19", // MLK Jr. Day
      "2026-02-16", // Washington's Birthday (postal)
      "2026-05-25", // Memorial Day
      "2026-06-19", // Juneteenth (Fri, postal)
      "2026-07-03", // Independence Day observed (Jul 4 is Saturday)
      "2026-09-07", // Labor Day
      "2026-10-12", // Columbus Day (postal)
      "2026-11-11", // Veterans' Day
      "2026-11-26", // Thanksgiving Day
      "2026-11-27", // Friday after Thanksgiving
      "2026-12-25", // Christmas Day (Fri)
    ]);
  });

  it("the 2027 calendar includes the Saturday/Sunday observances and nothing for Saturday Juneteenth", () => {
    expect(floridaRaClosuresInYear(2027).map((c) => c.date)).toEqual([
      "2027-01-01", // New Year's Day (Fri)
      "2027-01-18", // MLK Jr. Day
      "2027-02-15", // Washington's Birthday (postal)
      "2027-05-31", // Memorial Day
      // Juneteenth is Saturday, June 19: post offices close that Saturday only.
      "2027-07-05", // Independence Day observed (Jul 4 is Sunday)
      "2027-09-06", // Labor Day
      "2027-10-11", // Columbus Day (postal)
      "2027-11-11", // Veterans' Day
      "2027-11-25", // Thanksgiving Day
      "2027-11-26", // Friday after Thanksgiving
      "2027-12-24", // Christmas observed (Dec 25 is Saturday)
      "2027-12-31", // New Year's Day 2028 observed (Jan 1, 2028 is Saturday)
    ]);
  });

  it("weekday helper agrees with a plain calendar", () => {
    expect(weekday("2026-10-25")).toBe(0);
    expect(weekday("2026-10-24")).toBe(6);
    expect(weekday("2026-10-26")).toBe(1);
  });
});

describe("Florida RA appeal: trigger and sources", () => {
  it("is triggered by the determination's distributed date, and nothing else", () => {
    expect(FL.triggers).toHaveLength(1);
    expect(FL.triggers[0].questionId).toBe("ra_determination_mailed_date");
    expect(FL.triggers[0].label).toMatch(/distributed date/i);
    const question = NAVIGATORS.find((n) => n.slug === "job-separation")!.questions.find(
      (q) => q.id === "ra_determination_mailed_date",
    )!;
    expect(question.label).toMatch(/distributed date/i);
    expect(computeRuleDeadline(FL, { last_day: "2026-09-18" }, "2026-10-18").status).toBe("needs_verification");
  });

  it("keeps its citations, every primary reference, and a source-check date", () => {
    expect(FL.citation).toMatch(/File an Appeal/);
    expect(FL.citation).toMatch(/73B-20\.005/);
    expect(FL.citation).toMatch(/443\.151/);
    expect(FL.references.map((r) => r.url)).toEqual([
      "https://www.flrules.org/gateway/ruleNo.asp?id=73B-20.005",
      "https://www.flsenate.gov/Laws/Statutes/2025/443.151",
      "https://www.flsenate.gov/Laws/Statutes/2025/110.117",
      "https://www.law.cornell.edu/uscode/text/5/6103",
    ]);
    expect(FL.sourceCheckedOn).toBe("2026-10-18");
    // Honest about what it cannot know.
    expect(FL.caveats).toMatch(/unscheduled closures/);
    expect(FL.caveats).toMatch(/printed on your notice controls/);
  });

  it("a future distributed date is refused, not calculated", () => {
    expect(appeal("2026-10-19", "2026-10-18").status).toBe("needs_verification");
  });
});

/* ------------------------------------------------------------------ */

describe("COBRA election: both dates are required", () => {
  it("both missing → NEEDS VERIFICATION, asking for the notice date first and naming both", () => {
    const r = cobra({});
    expect(r.status).toBe("needs_verification");
    if (r.status !== "needs_verification") return;
    expect(r.missing.questionId).toBe("cobra_notice_provided_date");
    expect(r.reason).toMatch(/date the COBRA election notice was provided/);
    expect(r.reason).toMatch(/date your employer health coverage ends/);
    expect("date" in r).toBe(false);
  });

  it("notice date only → NEEDS VERIFICATION, asking for the coverage end date", () => {
    const r = cobra({ cobra_notice_provided_date: "2026-10-01" });
    expect(r).toMatchObject({ status: "needs_verification", missing: { questionId: "coverage_end_date" } });
  });

  it("coverage end date only → NEEDS VERIFICATION, asking for the notice date", () => {
    const r = cobra({ coverage_end_date: "2026-10-31" });
    expect(r).toMatchObject({ status: "needs_verification", missing: { questionId: "cobra_notice_provided_date" } });
    if (r.status === "needs_verification") expect(r.reason).toMatch(/not just the date printed on it/);
  });

  it("malformed dates count as missing", () => {
    for (const bad of ["", "soon", "2026-02-30", null]) {
      expect(cobra({ cobra_notice_provided_date: bad, coverage_end_date: "2026-10-31" }).status).toBe("needs_verification");
      expect(cobra({ cobra_notice_provided_date: "2026-10-01", coverage_end_date: bad }).status).toBe("needs_verification");
    }
  });

  it("an answer for the old 'date printed on the notice' question is not used", () => {
    expect(cobra({ cobra_notice_date: "2026-10-01", coverage_end_date: "2026-10-31" }).status).toBe("needs_verification");
  });

  it("a notice cannot have been provided in the future; coverage can end in the future", () => {
    expect(cobra({ cobra_notice_provided_date: "2026-10-20", coverage_end_date: "2026-10-31" }, "2026-10-18")).toMatchObject({
      status: "needs_verification",
      missing: { questionId: "cobra_notice_provided_date" },
    });
    expect(cobra({ cobra_notice_provided_date: "2026-10-15", coverage_end_date: "2026-11-30" }, "2026-10-18")).toMatchObject({
      status: "calculated",
      date: "2027-01-29",
    });
  });
});

describe("COBRA election: the later of the two dates", () => {
  it("notice provided BEFORE coverage ends → counted from coverage end", () => {
    const r = cobra({ cobra_notice_provided_date: "2026-10-09", coverage_end_date: "2026-10-31" });
    expect(r).toMatchObject({ status: "calculated", date: "2026-12-30", basis: { questionId: "coverage_end_date" } });
  });

  it("notice provided AFTER coverage ended → counted from the notice", () => {
    const r = cobra({ cobra_notice_provided_date: "2026-11-04", coverage_end_date: "2026-10-31" });
    expect(r).toMatchObject({ status: "calculated", date: "2027-01-03", basis: { questionId: "cobra_notice_provided_date" } });
  });

  it("the same day for both → 60 days after it", () => {
    expect(cobra({ cobra_notice_provided_date: "2026-10-31", coverage_end_date: "2026-10-31" })).toMatchObject({
      date: "2026-12-30",
    });
  });

  it("is a minimum period: not moved off weekends or holidays", () => {
    // Jan 3, 2027 is a Sunday; the regulation sets no next-business-day rule.
    const r = cobra({ cobra_notice_provided_date: "2026-11-04", coverage_end_date: "2026-10-31" });
    if (r.status !== "calculated") throw new Error("expected a date");
    expect(weekday(r.date)).toBe(0);
    expect(r.skipped).toEqual([]);
    expect(COBRA.lastDay).toBeUndefined();
    expect(COBRA.caveats).toMatch(/earliest date federal rules allow/);
    expect(COBRA.caveats).toMatch(/20 or more employees/);
  });
});

describe("COBRA election: calendar boundaries", () => {
  // [coverage end, notice provided, expected]
  const CASES: [string, string, string][] = [
    ["2026-12-31", "2026-12-10", "2027-03-01"], // year boundary, non-leap February
    ["2027-12-31", "2027-12-01", "2028-02-29"], // lands on leap day
    ["2027-10-15", "2028-01-01", "2028-03-01"], // leap year, counted from the notice
    ["2026-11-30", "2027-01-01", "2027-03-02"], // non-leap year, counted from the notice
    ["2027-01-31", "2027-01-20", "2027-04-01"], // month end through February
  ];
  for (const [coverageEnd, provided, expected] of CASES) {
    it(`coverage ${coverageEnd}, notice ${provided} → ${expected}`, () => {
      expect(cobra({ coverage_end_date: coverageEnd, cobra_notice_provided_date: provided }, "2028-06-01")).toMatchObject({
        status: "calculated",
        date: expected,
      });
    });
  }
});

describe("COBRA election in the Job Separation plan", () => {
  const BASE: Record<string, AnswerValue> = {
    separation_type: "laid_off",
    last_day: "2026-09-18",
    state: "Florida",
    received_final_pay: true,
    had_health_insurance: true,
    employer_size: "20_plus",
    cobra_notice_received: true,
    severance_offered: false,
    filed_unemployment: "filed",
  };
  const plan = (answers: Record<string, AnswerValue>): Case =>
    generatePlanForCase(
      {
        id: "c", userId: "u", navigatorSlug: "job-separation", title: "t", status: "intake", priority: "medium",
        serviceTier: "self_service", assignedTo: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
        intake: { answers, currentStep: 0, completed: true }, plan: null, tasks: [], documents: [], deadlines: [],
        letters: [], timeline: [], adminNotes: [],
      },
      "2026-10-18",
    );
  const cobraDeadline = (c: Case) => c.deadlines.find((d) => d.key === "rule:us-cobra-election");

  it("shows NEEDS VERIFICATION until both dates are known, and asks for the missing one", () => {
    const noticeOnly = cobraDeadline(plan({ ...BASE, cobra_notice_provided_date: "2026-10-01" }))!;
    expect(noticeOnly.date).toBeNull();
    expect(noticeOnly.trigger).toMatchObject({ questionId: "coverage_end_date", date: null });

    const coverageOnly = cobraDeadline(plan({ ...BASE, coverage_end_date: "2026-10-31" }))!;
    expect(coverageOnly.date).toBeNull();
    expect(coverageOnly.trigger).toMatchObject({ questionId: "cobra_notice_provided_date", date: null });

    const both = cobraDeadline(plan({ ...BASE, coverage_end_date: "2026-10-31", cobra_notice_provided_date: "2026-10-01" }))!;
    expect(both.date).toBe("2026-12-30");
    expect(both.note).toContain("Calculated as 60 days after the date your employer health coverage ends (2026-10-31)");
  });

  it("still applies only where federal COBRA plausibly applies (20+ employees)", () => {
    const answers = { ...BASE, coverage_end_date: "2026-10-31", cobra_notice_provided_date: "2026-10-01" };
    for (const size of ["under_20", "unsure"]) {
      const c = plan({ ...answers, employer_size: size });
      expect(cobraDeadline(c)).toBeUndefined();
      expect(c.deadlines.find((d) => d.key === "unavailable:continuation-election")?.date).toBeNull();
    }
  });

  it("the intake asks when the notice was provided, not what date is printed on it", () => {
    const q = NAVIGATORS.find((n) => n.slug === "job-separation")!.questions.find((x) => x.id === "cobra_notice_provided_date")!;
    expect(q.type).toBe("date");
    expect(q.label).toMatch(/provided to you/);
    expect(q.help).toMatch(/can differ from the date printed on the letter/);
    expect(q.showIf).toEqual({ questionId: "cobra_notice_received", equals: true });
    expect(NAVIGATORS.find((n) => n.slug === "job-separation")!.questions.some((x) => x.id === "cobra_notice_date")).toBe(false);
  });
});
