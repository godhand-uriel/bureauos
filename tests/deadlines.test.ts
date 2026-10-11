import { beforeAll, describe, expect, it } from "vitest";
import {
  addDays,
  dateOnlyFromStored,
  dateOnlyToUtcNoon,
  daysFromToday,
  diffDays,
  formatDateOnly,
  isDateOnly,
  parseDateOnly,
  relativeDay,
} from "@/lib/dates";
import { DEADLINE_RULES, computeRuleDeadline, getDeadlineRule } from "@/lib/deadline-rules";
import { generatePlanForCase, mergeDeadlines, nextActionFor } from "@/lib/plan-engine";
import { NAVIGATORS } from "@/lib/navigators";
import { JURISDICTION_RULES, rulesForCase } from "@/lib/jurisdictions";
import { pruneHiddenAnswers, visibleQuestions } from "@/lib/intake";
import { normalizeUsState } from "@/lib/us-states";
import { prisma } from "@/lib/server/db";
import { performCaseAction } from "@/lib/server/case-actions";
import type { SessionUser } from "@/lib/server/auth";
import { DISCLAIMER_VERSION } from "@/lib/constants";
import type { AnswerValue, Case, NavigatorSlug } from "@/lib/types";

/**
 * Deadline engine: calendar math, the source-backed rule registry, and the
 * guarantee that an official deadline is never given a fabricated date.
 */

const TODAY = "2026-10-11";

function makeCase(navigatorSlug: NavigatorSlug, answers: Record<string, AnswerValue>): Case {
  return {
    id: "case-under-test",
    userId: "user-under-test",
    navigatorSlug,
    title: "test",
    status: "intake",
    priority: "medium",
    serviceTier: "self_service",
    assignedTo: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    intake: { answers, currentStep: 0, completed: true },
    plan: null,
    tasks: [],
    documents: [],
    deadlines: [],
    letters: [],
    timeline: [],
    adminNotes: [],
  };
}

const FL_BASE: Record<string, AnswerValue> = {
  separation_type: "laid_off",
  last_day: "2026-09-18",
  state: "Florida",
  received_final_pay: true,
  had_health_insurance: false,
  severance_offered: false,
  filed_unemployment: "filed",
};

/* ------------------------------------------------------------------ */

describe("calendar-date arithmetic", () => {
  it("rejects impossible and malformed dates", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-1-5", "10/11/2026", "", "2026-02-29", null, undefined, 20261011]) {
      expect(parseDateOnly(bad)).toBeNull();
      expect(isDateOnly(bad)).toBe(false);
    }
    expect(parseDateOnly("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 }); // leap year
    expect(parseDateOnly(" 2026-10-11 ")).toEqual({ y: 2026, m: 10, d: 11 });
  });

  it("adds days across month, year, and leap-day boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-25", 20)).toBe("2027-01-14");
    expect(addDays("2027-02-10", 20)).toBe("2027-03-02"); // non-leap February
    expect(addDays("2028-02-10", 20)).toBe("2028-03-01"); // leap February
    expect(addDays("2028-02-29", 365)).toBe("2029-02-28");
    expect(addDays("2026-10-11", 0)).toBe("2026-10-11");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => addDays("not-a-date", 1)).toThrow();
  });

  it("is unaffected by daylight-saving transitions", () => {
    // US spring-forward (Mar 8, 2026) and fall-back (Nov 1, 2026) both sit inside these spans.
    expect(addDays("2026-03-01", 20)).toBe("2026-03-21");
    expect(diffDays("2026-03-01", "2026-03-21")).toBe(20);
    expect(addDays("2026-10-20", 20)).toBe("2026-11-09");
    expect(diffDays("2026-10-20", "2026-11-09")).toBe(20);
    expect(diffDays("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("stores and reloads a calendar date without shifting the day", () => {
    for (const d of ["2026-01-01", "2026-08-01", "2026-12-31", "2028-02-29"]) {
      const stored = dateOnlyToUtcNoon(d);
      expect(stored.toISOString()).toBe(`${d}T12:00:00.000Z`);
      expect(dateOnlyFromStored(stored)).toBe(d);
    }
  });

  it("documents the bug this replaces: parsing a date string as an instant shifts it in US time zones", () => {
    const naive = new Date("2026-08-01"); // UTC midnight
    const inNewYork = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(naive);
    expect(inNewYork).toBe("Jul 31"); // wrong day
    // The date-only formatter never goes through an instant, so it cannot shift.
    expect(formatDateOnly("2026-08-01")).toMatch(/Aug\D+1\b/);
    expect(formatDateOnly(null)).toBe("—");
  });

  it("counts days relative to a given today", () => {
    expect(daysFromToday("2026-10-31", TODAY)).toBe(20);
    expect(daysFromToday("2026-10-11", TODAY)).toBe(0);
    expect(daysFromToday("2026-10-01", TODAY)).toBe(-10);
    expect(relativeDay("2026-10-12", TODAY)).toBe("Tomorrow");
    expect(relativeDay("2026-10-01", TODAY)).toBe("10d past");
  });
});

/* ------------------------------------------------------------------ */

describe("rule registry", () => {
  it("every rule records a citation, an https source, and a check date that is not in the future", () => {
    const ids = new Set<string>();
    for (const rule of DEADLINE_RULES) {
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
      expect(rule.citation.length).toBeGreaterThan(5);
      expect(rule.sourceUrl).toMatch(/^https:\/\//);
      expect(isDateOnly(rule.sourceCheckedOn)).toBe(true);
      expect(rule.sourceCheckedOn <= new Date().toISOString().slice(0, 10)).toBe(true);
      expect(rule.offsetDays).toBeGreaterThan(0);
      expect(rule.ruleSummary.length).toBeGreaterThan(20);
      expect(rule.caveats.length).toBeGreaterThan(20);
      // No rule may be triggered by the last day of work.
      expect(rule.trigger.questionId).not.toBe("last_day");
      expect(rule.laterOf?.questionId).not.toBe("last_day");
    }
  });

  it("Florida appeal: 20 days after the mailing date, from the notice — not the separation", () => {
    const rule = getDeadlineRule("fl-ra-appeal")!;
    expect(rule.citation).toContain("443.151");
    const r = computeRuleDeadline(rule, { ra_determination_mailed_date: "2026-10-05" }, TODAY);
    expect(r).toMatchObject({ status: "calculated", date: "2026-10-25" });
    if (r.status === "calculated") expect(r.basis.date).toBe("2026-10-05");
    // Year boundary
    expect(computeRuleDeadline(rule, { ra_determination_mailed_date: "2026-12-20" }, "2026-12-22")).toMatchObject({
      status: "calculated",
      date: "2027-01-09",
    });
    // The separation date alone establishes nothing.
    expect(computeRuleDeadline(rule, { last_day: "2026-09-18" }, TODAY).status).toBe("needs_verification");
  });

  it("returns NEEDS VERIFICATION for a missing, malformed, or future trigger — never a guess", () => {
    const rule = getDeadlineRule("fl-ra-appeal")!;
    for (const answers of [
      {},
      { ra_determination_mailed_date: "" },
      { ra_determination_mailed_date: "soon" },
      { ra_determination_mailed_date: "2026-02-30" },
      { ra_determination_mailed_date: null },
      { ra_determination_mailed_date: "2026-10-12" }, // tomorrow: a notice can't be mailed in the future
    ]) {
      const r = computeRuleDeadline(rule, answers as Record<string, AnswerValue>, TODAY);
      expect(r.status).toBe("needs_verification");
      expect("date" in r).toBe(false);
    }
  });

  it("COBRA: 60 days from the LATER of coverage loss and the election notice; needs the notice", () => {
    const rule = getDeadlineRule("us-cobra-election")!;
    // Coverage ends after the notice → count from coverage end.
    const a = computeRuleDeadline(rule, { cobra_notice_date: "2026-10-01", coverage_end_date: "2026-10-31" }, TODAY);
    expect(a).toMatchObject({ status: "calculated", date: "2026-12-30" });
    if (a.status === "calculated") expect(a.basis.questionId).toBe("coverage_end_date");
    // Notice arrives after coverage ended → count from the notice.
    const b = computeRuleDeadline(rule, { cobra_notice_date: "2026-10-09", coverage_end_date: "2026-09-30" }, TODAY);
    expect(b).toMatchObject({ status: "calculated", date: "2026-12-08" });
    if (b.status === "calculated") expect(b.basis.questionId).toBe("cobra_notice_date");
    // Notice only.
    expect(computeRuleDeadline(rule, { cobra_notice_date: "2026-10-01" }, TODAY)).toMatchObject({ date: "2026-11-30" });
    // Coverage end alone does not establish the election deadline.
    expect(computeRuleDeadline(rule, { coverage_end_date: "2026-10-31" }, TODAY).status).toBe("needs_verification");
  });

  it("Marketplace: 60 days after coverage ends; a future coverage end date is valid", () => {
    const rule = getDeadlineRule("us-marketplace-sep")!;
    expect(computeRuleDeadline(rule, { coverage_end_date: "2026-10-31" }, TODAY)).toMatchObject({
      status: "calculated",
      date: "2026-12-30",
    });
    expect(computeRuleDeadline(rule, {}, TODAY).status).toBe("needs_verification");
  });
});

/* ------------------------------------------------------------------ */

describe("job separation plan", () => {
  const plan = (answers: Record<string, AnswerValue>) =>
    generatePlanForCase(makeCase("job-separation", answers), TODAY);
  const byKey = (c: Case, key: string) => c.deadlines.find((d) => d.key === key);

  it("Florida + determination date → calculated, source-backed appeal deadline", () => {
    const c = plan({ ...FL_BASE, filed_unemployment: "denied", ra_determination_mailed_date: "2026-10-05" });
    const d = byKey(c, "rule:fl-ra-appeal")!;
    expect(d).toMatchObject({ kind: "official", date: "2026-10-25", verified: false });
    expect(d.source).toMatchObject({ ruleId: "fl-ra-appeal", jurisdiction: "Florida", checkedOn: "2026-10-10" });
    expect(d.source?.url).toContain("flsenate.gov");
    expect(d.trigger).toMatchObject({ questionId: "ra_determination_mailed_date", date: "2026-10-05" });
    expect(d.note).toContain("official notice");
    expect(c.plan?.priority).toBe("urgent");
  });

  it("Florida without the determination date → NEEDS VERIFICATION, with the rule shown and the date requested", () => {
    const c = plan({ ...FL_BASE, filed_unemployment: "denied" });
    const d = byKey(c, "rule:fl-ra-appeal")!;
    expect(d.kind).toBe("official");
    expect(d.date).toBeNull();
    expect(d.source?.citation).toContain("443.151");
    expect(d.trigger).toMatchObject({ questionId: "ra_determination_mailed_date", date: null });
    expect(d.note).toMatch(/Not calculated/);
    expect(nextActionFor(c, TODAY).title).toMatch(/^Needs verification/);
  });

  it("a state outside the pilot gets no calculated deadline even when every date is supplied", () => {
    const c = plan({
      ...FL_BASE,
      state: "Georgia",
      filed_unemployment: "denied",
      ra_determination_mailed_date: "2026-10-05",
      had_health_insurance: true,
      employer_size: "20_plus",
      cobra_notice_received: true,
      cobra_notice_date: "2026-10-01",
      coverage_end_date: "2026-10-31",
      received_final_pay: false,
    });
    const official = c.deadlines.filter((d) => d.kind === "official");
    expect(official.length).toBeGreaterThanOrEqual(4);
    for (const d of official) {
      expect(d.date).toBeNull();
      expect(d.source).toBeUndefined();
      expect(d.note).toMatch(/Not calculated/);
    }
    expect(c.plan?.situationSummary).toContain("aren't available for Georgia");
  });

  it("an unrecognised state is treated as not established, never as Florida", () => {
    expect(normalizeUsState("Flordia")).toBeNull();
    expect(normalizeUsState(" fl ")?.code).toBe("FL");
    expect(normalizeUsState("florida")?.code).toBe("FL");
    const c = plan({ ...FL_BASE, state: "Flordia", filed_unemployment: "denied", ra_determination_mailed_date: "2026-10-05" });
    expect(c.deadlines.every((d) => d.kind !== "official" || d.date === null)).toBe(true);
  });

  it("nothing is counted from the last day of work", () => {
    const c = plan({
      ...FL_BASE,
      last_day: "2026-09-18",
      filed_unemployment: "denied",
      had_health_insurance: true,
      employer_size: "20_plus",
      received_final_pay: false,
    });
    const official = c.deadlines.filter((d) => d.kind === "official");
    expect(official.map((d) => d.key).sort()).toEqual(["rule:fl-ra-appeal", "rule:us-cobra-election", "rule:us-marketplace-sep"]);
    expect(official.every((d) => d.date === null)).toBe(true);
    // And no "file your claim by" date is invented for someone who hasn't filed.
    const notFiled = plan({ ...FL_BASE, filed_unemployment: "no" });
    expect(notFiled.deadlines.filter((d) => d.kind !== "suggested")).toHaveLength(0);
    expect(notFiled.deadlines.some((d) => /unemployment/i.test(d.title))).toBe(false);
  });

  it("COBRA is calculated only when federal COBRA plausibly applies", () => {
    const withDates = { ...FL_BASE, had_health_insurance: true, cobra_notice_received: true, cobra_notice_date: "2026-10-01", coverage_end_date: "2026-10-31" };
    expect(byKey(plan({ ...withDates, employer_size: "20_plus" }), "rule:us-cobra-election")?.date).toBe("2026-12-30");
    for (const size of ["under_20", "unsure"]) {
      const c = plan({ ...withDates, employer_size: size });
      expect(byKey(c, "rule:us-cobra-election")).toBeUndefined();
      const d = byKey(c, "unavailable:continuation-election")!;
      expect(d.date).toBeNull();
      expect(d.note).toMatch(/Not calculated/);
    }
    // Marketplace enrollment is still calculated from the coverage end date.
    expect(byKey(plan({ ...withDates, employer_size: "under_20" }), "rule:us-marketplace-sep")?.date).toBe("2026-12-30");
  });

  it("a payday the user entered is tracked as self-reported, not as an official deadline", () => {
    const c = plan({ ...FL_BASE, received_final_pay: false, next_regular_payday: "2026-10-16" });
    const d = c.deadlines.find((x) => x.kind === "self_reported")!;
    expect(d.date).toBe("2026-10-16");
    expect(d.source).toBeUndefined();
    expect(plan({ ...FL_BASE, received_final_pay: false }).deadlines.some((x) => x.kind === "self_reported")).toBe(false);
  });

  it("adding the date later updates the same deadline and clears a stale confirmation", () => {
    const first = plan({ ...FL_BASE, filed_unemployment: "denied" });
    const before = byKey(first, "rule:fl-ra-appeal")!;
    const withDate: Case = {
      ...first,
      intake: { ...first.intake, answers: { ...first.intake.answers, ra_determination_mailed_date: "2026-10-05" } },
    };
    const second = generatePlanForCase(withDate, TODAY);
    const after = byKey(second, "rule:fl-ra-appeal")!;
    expect(after.id).toBe(before.id);
    expect(after.date).toBe("2026-10-25");
    expect(second.deadlines.filter((d) => d.key === "rule:fl-ra-appeal")).toHaveLength(1);

    // User confirms it, then corrects the mailing date → confirmation must reset.
    const confirmed: Case = {
      ...second,
      deadlines: second.deadlines.map((d) => (d.id === after.id ? { ...d, verified: true } : d)),
      intake: { ...second.intake, answers: { ...second.intake.answers, ra_determination_mailed_date: "2026-10-07" } },
    };
    const third = generatePlanForCase(confirmed, TODAY);
    expect(byKey(third, "rule:fl-ra-appeal")).toMatchObject({ date: "2026-10-27", verified: false });
  });

  it("drops a deadline the answers no longer support", () => {
    const denied = plan({ ...FL_BASE, filed_unemployment: "denied", ra_determination_mailed_date: "2026-10-05" });
    const reversed: Case = {
      ...denied,
      intake: { ...denied.intake, answers: { ...denied.intake.answers, filed_unemployment: "filed" } },
    };
    expect(generatePlanForCase(reversed, TODAY).deadlines.some((d) => d.key === "rule:fl-ra-appeal")).toBe(false);
  });
});

describe("deadline invariants across every navigator", () => {
  const SAMPLES: Record<NavigatorSlug, Record<string, AnswerValue>[]> = {
    "job-separation": [
      { ...FL_BASE, filed_unemployment: "denied", ra_determination_mailed_date: "2026-10-05", had_health_insurance: true, employer_size: "20_plus", coverage_end_date: "2026-10-31", received_final_pay: false, next_regular_payday: "2026-10-16" },
      { ...FL_BASE, state: "Texas", filed_unemployment: "denied", had_health_insurance: true, received_final_pay: false },
    ],
    dmv: [
      { issue_type: "suspension", state: "Texas", notice_received: true, notice_deadline: "2026-11-01", owes_fees: true, needs_to_drive: true },
      { issue_type: "renewal", state: "Florida", notice_received: false },
    ],
    "small-business": [
      { business_stage: "behind", state: "Florida", annual_report_due: "2027-05-01" },
      { business_stage: "operating", state: "Florida" },
    ],
    "insurance-denial": [
      { insurance_type: "health", denial_date: "2026-10-01", denial_reason: "pre_auth", appeal_deadline_known: true, appeal_deadline: "2027-03-30" },
      { insurance_type: "health", denial_date: "2026-10-01", denial_reason: "other", already_appealed: true },
      { insurance_type: "auto", denial_date: "2026-10-01", denial_reason: "not_covered", appeal_deadline_known: false },
    ],
    "veteran-benefits": [
      { benefit_categories: ["disability"], claim_stage: "preparing", has_dd214: true },
      { benefit_categories: ["disability"], claim_stage: "decided", decision_date: "2026-08-01" },
      { benefit_categories: ["disability"], claim_stage: "decided" },
    ],
    "tenant-rights": [
      { issue_type: "eviction_notice", state: "Florida", notice_deadline: "2026-10-20" },
      { issue_type: "eviction_notice", state: "Florida" },
      { issue_type: "deposit", state: "California" },
      { issue_type: "repairs", state: "California", repair_severity: "major" },
    ],
  };

  it("an official deadline has a date only when a registry rule produced it", () => {
    for (const nav of NAVIGATORS) {
      for (const answers of SAMPLES[nav.slug]) {
        const c = generatePlanForCase(makeCase(nav.slug, answers), TODAY);
        for (const d of c.deadlines) {
          expect(["official", "self_reported", "suggested"]).toContain(d.kind);
          if (d.kind === "official" && d.date !== null) {
            expect(d.source, `${nav.slug}: "${d.title}" has an official date with no source`).toBeDefined();
            expect(getDeadlineRule(d.source!.ruleId)).toBeDefined();
          }
          if (d.kind === "official" && d.date === null) {
            expect(d.note, `${nav.slug}: "${d.title}" needs an explanation`).toBeTruthy();
          }
          if (d.date !== null) expect(isDateOnly(d.date)).toBe(true);
        }
      }
    }
  });

  it("only the launch navigator can produce calculated official deadlines", () => {
    for (const nav of NAVIGATORS.filter((n) => n.launchStatus === "preview")) {
      for (const answers of SAMPLES[nav.slug]) {
        const c = generatePlanForCase(makeCase(nav.slug, answers), TODAY);
        expect(c.deadlines.filter((d) => d.kind === "official" && d.date !== null)).toHaveLength(0);
      }
    }
    expect(NAVIGATORS.filter((n) => n.launchStatus === "live").map((n) => n.slug)).toEqual(["job-separation"]);
    expect(NAVIGATORS).toHaveLength(6);
  });

  it("suggested follow-ups keep their original date when the plan is regenerated later", () => {
    const first = generatePlanForCase(makeCase("tenant-rights", SAMPLES["tenant-rights"][3]), TODAY);
    const suggested = first.deadlines.find((d) => d.kind === "suggested")!;
    expect(suggested.date).toBe(addDays(TODAY, 14));
    const later = generatePlanForCase(first, "2026-11-20");
    expect(later.deadlines.find((d) => d.key === suggested.key)).toMatchObject({ id: suggested.id, date: suggested.date });
  });

  it("mergeDeadlines upgrades legacy rows (no key) in place by title", () => {
    const legacy = { id: "old-1", key: "", title: "Follow up on repair request", kind: "suggested" as const, date: "2026-07-24", verified: true };
    const merged = mergeDeadlines([legacy], [{ key: "suggested:follow-up-on-repair-request", title: "Follow up on repair request", kind: "suggested", date: "2026-10-25" }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "old-1", date: "2026-07-24", verified: true, key: "suggested:follow-up-on-repair-request" });
  });
});

/* ------------------------------------------------------------------ */

describe("jurisdiction notes", () => {
  it("shows only source-checked notes, and only for the pilot state", () => {
    const fl = rulesForCase("job-separation", "Florida");
    expect(fl.map((r) => r.id).sort()).toEqual(["fl-final-pay", "fl-ra-appeal", "us-cobra-election", "us-marketplace-sep"]);
    expect(fl.every((r) => r.reviewStatus === "source_checked")).toBe(true);
    expect(rulesForCase("job-separation", "FL")).toHaveLength(4);
    expect(rulesForCase("job-separation", "Texas")).toEqual([]);
    expect(rulesForCase("job-separation", "")).toEqual([]);
    expect(rulesForCase("job-separation", undefined)).toEqual([]);
  });

  it("never surfaces the unverified sample content for any navigator or state", () => {
    const samples = JURISDICTION_RULES.filter((r) => r.reviewStatus === "unverified_sample");
    expect(samples.length).toBeGreaterThan(0); // preserved in the file…
    for (const nav of NAVIGATORS) {
      for (const state of ["California", "Texas", "Washington", "Florida", "Federal (US)"]) {
        expect(rulesForCase(nav.slug, state).some((r) => r.reviewStatus !== "source_checked")).toBe(false); // …but never shown
      }
    }
    for (const r of JURISDICTION_RULES.filter((x) => x.reviewStatus === "source_checked")) {
      expect(r.navigatorSlug).toBe("job-separation");
      expect(isDateOnly(r.lastUpdated)).toBe(true);
      expect(r.officialLinks.length).toBeGreaterThan(0);
      for (const link of r.officialLinks) expect(link.url).toMatch(/^https:\/\//);
    }
  });
});

describe("intake branching", () => {
  const questions = NAVIGATORS.find((n) => n.slug === "job-separation")!.questions;

  it("hides follow-ups through the whole chain and prunes their stale answers", () => {
    const answers = { had_health_insurance: false, cobra_notice_received: true, cobra_notice_date: "2026-10-01", coverage_end_date: "2026-10-31" };
    const visible = visibleQuestions(questions, answers).map((q) => q.id);
    expect(visible).not.toContain("cobra_notice_received");
    expect(visible).not.toContain("cobra_notice_date"); // parent matches, grandparent doesn't
    expect(visible).not.toContain("coverage_end_date");
    const pruned = pruneHiddenAnswers(questions, answers);
    expect(pruned).toEqual({ had_health_insurance: false });
  });
});

/* ------------------------------------------------------------------ */

describe("server actions for deadlines", () => {
  let owner: SessionUser;
  let stranger: SessionUser;
  let caseId: string;

  const answersFor = (extra: Record<string, AnswerValue>) =>
    Object.entries({ ...FL_BASE, filed_unemployment: "denied", ...extra }).map(([questionId, value]) => ({
      questionId,
      valueJson: JSON.stringify(value),
    }));

  beforeAll(async () => {
    owner = (await prisma.user.create({
      data: { email: `deadline-owner-${Date.now()}@example.com`, name: "Owner", passwordHash: "x", role: "customer" },
      include: { notificationPrefs: true },
    })) as SessionUser;
    stranger = (await prisma.user.create({
      data: { email: `deadline-stranger-${Date.now()}@example.com`, name: "Stranger", passwordHash: "x", role: "customer" },
      include: { notificationPrefs: true },
    })) as SessionUser;
    const kase = await prisma.case.create({
      data: { userId: owner.id, navigatorSlug: "job-separation", title: "FL appeal", answers: { create: answersFor({}) } },
    });
    caseId = kase.id;
    await prisma.disclaimerAcceptance.create({
      data: { userId: owner.id, caseId, version: DISCLAIMER_VERSION, acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true },
    });
  });

  it("completing intake persists an undated official deadline as NULL — not a date", async () => {
    const result = await performCaseAction(owner, caseId, { type: "complete_intake" });
    expect(result.ok).toBe(true);
    const row = await prisma.deadline.findFirstOrThrow({ where: { caseId, key: "rule:fl-ra-appeal" } });
    expect(row.kind).toBe("official");
    expect(row.date).toBeNull();
    expect(JSON.parse(row.sourceJson!).citation).toContain("443.151");
  });

  it("refuses to mark an undated deadline as verified", async () => {
    const row = await prisma.deadline.findFirstOrThrow({ where: { caseId, key: "rule:fl-ra-appeal" } });
    const result = await performCaseAction(owner, caseId, { type: "toggle_deadline", deadlineId: row.id });
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("rejects bad trigger input and other users", async () => {
    const tomorrow = addDays(new Date().toISOString().slice(0, 10), 3);
    expect(await performCaseAction(owner, caseId, { type: "set_trigger_date", questionId: "ra_determination_mailed_date", date: tomorrow })).toMatchObject({ ok: false, status: 400 });
    expect(await performCaseAction(owner, caseId, { type: "set_trigger_date", questionId: "ra_determination_mailed_date", date: "2026-02-30" })).toMatchObject({ ok: false, status: 400 });
    expect(await performCaseAction(owner, caseId, { type: "set_trigger_date", questionId: "separation_type", date: "2026-10-05" })).toMatchObject({ ok: false, status: 400 });
    expect(await performCaseAction(owner, caseId, { type: "set_trigger_date", questionId: "not_a_question", date: "2026-10-05" })).toMatchObject({ ok: false, status: 400 });
    expect(await performCaseAction(stranger, caseId, { type: "set_trigger_date", questionId: "ra_determination_mailed_date", date: "2026-10-05" })).toMatchObject({ ok: false, status: 404 });
    const row = await prisma.deadline.findFirstOrThrow({ where: { caseId, key: "rule:fl-ra-appeal" } });
    expect(row.date).toBeNull();
  });

  it("recording the notice date calculates the deadline in place and stores it at noon UTC", async () => {
    const before = await prisma.deadline.findFirstOrThrow({ where: { caseId, key: "rule:fl-ra-appeal" } });
    const result = await performCaseAction(owner, caseId, { type: "set_trigger_date", questionId: "ra_determination_mailed_date", date: "2026-10-05" });
    expect(result.ok).toBe(true);
    const rows = await prisma.deadline.findMany({ where: { caseId, key: "rule:fl-ra-appeal" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(before.id);
    expect(rows[0].date?.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    if (result.ok) {
      const d = result.case.deadlines.find((x) => x.key === "rule:fl-ra-appeal")!;
      expect(d).toMatchObject({ date: "2026-10-25", kind: "official" });
      expect(d.trigger?.date).toBe("2026-10-05");
    }
    // …and it can now be confirmed against the notice.
    expect((await performCaseAction(owner, caseId, { type: "toggle_deadline", deadlineId: before.id })).ok).toBe(true);
  });

  it("entering a COBRA notice date also records that the notice was received", async () => {
    for (const [questionId, value] of [["had_health_insurance", true], ["employer_size", "20_plus"]] as const) {
      await prisma.intakeAnswer.upsert({
        where: { caseId_questionId: { caseId, questionId } },
        create: { caseId, questionId, valueJson: JSON.stringify(value) },
        update: { valueJson: JSON.stringify(value) },
      });
    }
    const result = await performCaseAction(owner, caseId, { type: "set_trigger_date", questionId: "cobra_notice_date", date: "2026-10-01" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.case.intake.answers.cobra_notice_received).toBe(true);
      expect(result.case.deadlines.find((d) => d.key === "rule:us-cobra-election")?.date).toBe("2026-11-30");
    }
  });

  it("intake can be reopened and completed again; answers that changed drop their deadlines", async () => {
    expect((await performCaseAction(owner, caseId, { type: "reopen_intake" })).ok).toBe(true);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).intakeCompleted).toBe(false);
    const current = await prisma.intakeAnswer.findMany({ where: { caseId } });
    const answers = Object.fromEntries(current.map((a) => [a.questionId, JSON.parse(a.valueJson)]));
    answers.filed_unemployment = "filed"; // the denial was reversed
    expect((await performCaseAction(owner, caseId, { type: "save_intake", answers, step: 0 })).ok).toBe(true);
    const result = await performCaseAction(owner, caseId, { type: "complete_intake" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.case.deadlines.some((d) => d.key === "rule:fl-ra-appeal")).toBe(false);
      // The now-hidden determination date was pruned, not left behind.
      expect(result.case.intake.answers.ra_determination_mailed_date).toBeUndefined();
      expect(result.case.timeline.filter((e) => e.type === "intake_completed")).toHaveLength(2);
    }
  });

  it("rejects completing an intake with required answers missing", async () => {
    const kase = await prisma.case.create({
      data: { userId: owner.id, navigatorSlug: "job-separation", title: "incomplete", answers: { create: [{ questionId: "separation_type", valueJson: JSON.stringify("quit") }] } },
    });
    await prisma.disclaimerAcceptance.create({
      data: { userId: owner.id, caseId: kase.id, version: DISCLAIMER_VERSION, acceptedTerms: true, acceptedPrivacy: true, acceptedDisclaimer: true },
    });
    const result = await performCaseAction(owner, kase.id, { type: "complete_intake" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(await prisma.actionPlan.findUnique({ where: { caseId: kase.id } })).toBeNull();
  });
});
