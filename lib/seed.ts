import type { AnswerValue, Case, NavigatorSlug } from "@/lib/types";
import { generatePlanForCase } from "@/lib/plan-engine";
import { getNavigator } from "@/lib/navigators";
import { daysFromNow, uid } from "@/lib/utils";

/**
 * Demo seed data (development only): realistic cases built by actually
 * running each navigator's intake + plan engine, then simulating some user
 * progress so the app feels lived-in on first open.
 */

interface SeedSpec {
  slug: NavigatorSlug;
  title: string;
  createdDaysAgo: number;
  answers: Record<string, AnswerValue>;
  completeTaskCount: number;
  obtainDocCount: number;
  extraTimeline?: { daysAgo: number; title: string; detail?: string }[];
}

const SEEDS: SeedSpec[] = [
  {
    // The launch product: a Florida job-separation case with real trigger
    // dates, so the demo shows calculated, source-backed deadlines next to
    // one that still needs verification (no COBRA notice received yet).
    slug: "job-separation",
    title: "Layoff — Sunrise Logistics",
    createdDaysAgo: 9,
    answers: {
      separation_type: "laid_off",
      last_day: daysFromNow(-20).slice(0, 10),
      state: "Florida",
      received_final_pay: false,
      next_regular_payday: daysFromNow(5).slice(0, 10),
      had_health_insurance: true,
      coverage_end_date: daysFromNow(10).slice(0, 10),
      employer_size: "20_plus",
      cobra_notice_received: false,
      severance_offered: false,
      filed_unemployment: "denied",
      ra_determination_mailed_date: daysFromNow(-6).slice(0, 10),
      documents_on_hand: ["paystubs", "termination_letter"],
      hr_contact: { name: "HR Department", organization: "Sunrise Logistics" },
      situation_notes:
        "Position eliminated in a restructuring. Final check hasn't arrived and the unemployment claim was denied over a wage-reporting issue.",
    },
    completeTaskCount: 2,
    obtainDocCount: 2,
    extraTimeline: [
      { daysAgo: 6, title: "Received determination notice", detail: "Reemployment Assistance determination arrived by mail." },
    ],
  },
  {
    slug: "tenant-rights",
    title: "Bathroom ceiling leak — Oakwood Apt 4B",
    createdDaysAgo: 12,
    answers: {
      issue_type: "repairs",
      state: "California",
      has_lease: true,
      issue_start: daysFromNow(-30).slice(0, 10),
      repair_severity: "major",
      reported_before: "verbal",
      rent_current: true,
      evidence_on_hand: ["lease", "photos", "messages"],
      landlord_contact: { name: "Oakwood Property Management", phone: "(555) 201-4477" },
      situation_notes:
        "The bathroom ceiling has been leaking since early last month. Water stains are spreading and there's a musty smell. I texted the property manager twice with photos and was told 'we'll send someone' — no one has come.",
    },
    completeTaskCount: 3,
    obtainDocCount: 3,
    extraTimeline: [
      { daysAgo: 10, title: "Texted property manager with photos", detail: "First report of the leak, sent 4 photos. Reply: 'We'll send someone this week.'" },
      { daysAgo: 5, title: "Second text follow-up", detail: "No repair visit happened. Asked for a scheduled date. No reply yet." },
    ],
  },
  {
    slug: "insurance-denial",
    title: "MRI claim denial — Meridian Health",
    createdDaysAgo: 8,
    answers: {
      insurance_type: "health",
      denial_date: daysFromNow(-14).slice(0, 10),
      denial_reason: "not_medically_necessary",
      claim_amount: 3800,
      appeal_deadline_known: true,
      appeal_deadline: daysFromNow(45).slice(0, 10),
      urgent_care: false,
      already_appealed: false,
      evidence_on_hand: ["denial_letter", "records"],
      insurer_contact: { name: "Meridian Health Appeals Dept", organization: "Meridian Health" },
      situation_notes:
        "My doctor ordered an MRI of my lower back after six weeks of physical therapy didn't improve the pain. Meridian denied it as 'not medically necessary' even though PT was tried first, which their own policy lists as the prerequisite.",
    },
    completeTaskCount: 2,
    obtainDocCount: 2,
    extraTimeline: [
      { daysAgo: 6, title: "Called insurer for denial details", detail: "Rep: denial code MN-204, spoke with 'Angela', ref #88213. Confirmed appeals address on letter is current." },
    ],
  },
  {
    slug: "dmv",
    title: "License suspension — unpaid tickets",
    createdDaysAgo: 5,
    answers: {
      issue_type: "suspension",
      suspension_reason: "unpaid_tickets",
      state: "Texas",
      notice_received: true,
      notice_deadline: daysFromNow(21).slice(0, 10),
      owes_fees: true,
      fee_amount: 485,
      needs_to_drive: true,
      documents_on_hand: ["id", "notice"],
      situation_notes:
        "Got a suspension notice tied to two unpaid tickets from last year. I need to drive to work. Trying to figure out the fastest path to reinstatement and whether a payment plan is possible.",
    },
    completeTaskCount: 1,
    obtainDocCount: 1,
  },
  {
    slug: "veteran-benefits",
    title: "Disability claim prep — back & tinnitus",
    createdDaysAgo: 20,
    answers: {
      benefit_categories: ["disability", "healthcare"],
      claim_stage: "preparing",
      service_period: "post_911",
      has_dd214: true,
      conditions:
        "Chronic lower back pain from carrying gear on deployments (2014–2016), tinnitus from flight line work without adequate hearing protection.",
      receiving_treatment: true,
      has_vso: false,
      evidence_on_hand: ["dd214", "private_medical"],
      situation_notes: "Planning to file within the next couple of months. Want the evidence file airtight before submitting.",
    },
    completeTaskCount: 2,
    obtainDocCount: 2,
    extraTimeline: [
      { daysAgo: 15, title: "Requested service treatment records", detail: "Submitted records request through the National Archives eVetRecs portal." },
    ],
  },
];

export function buildSeedCases(
  userId: string,
  serviceTier: Case["serviceTier"] = "self_service",
): Case[] {
  return SEEDS.map((seed) => {
    const nav = getNavigator(seed.slug);
    const createdAt = daysFromNow(-seed.createdDaysAgo);
    let kase: Case = {
      id: uid(),
      userId,
      navigatorSlug: seed.slug,
      title: seed.title,
      status: "intake",
      priority: "medium",
      serviceTier,
      assignedTo: null,
      adminNotes: [],
      createdAt,
      updatedAt: createdAt,
      intake: { answers: seed.answers, currentStep: 0, completed: true },
      plan: null,
      tasks: [],
      documents: [],
      deadlines: [],
      letters: [],
      timeline: [
        {
          id: uid(),
          type: "case_created",
          title: "Case created",
          detail: `Started in the ${nav?.name ?? "navigator"}. (Demo case)`,
          date: createdAt,
        },
        {
          id: uid(),
          type: "intake_completed",
          title: "Intake completed",
          detail: "All intake questions answered.",
          date: createdAt,
        },
      ],
    };

    kase = generatePlanForCase(kase);

    // Simulate progress: complete some tasks and obtain some documents.
    let completed = 0;
    kase.tasks = kase.tasks.map((t) => {
      if (completed < seed.completeTaskCount) {
        completed += 1;
        return { ...t, done: true };
      }
      return t;
    });
    let obtained = 0;
    kase.documents = kase.documents.map((d) => {
      if (obtained < seed.obtainDocCount) {
        obtained += 1;
        return { ...d, status: "obtained" as const };
      }
      return d;
    });

    for (const evt of seed.extraTimeline ?? []) {
      kase.timeline.push({
        id: uid(),
        type: "communication",
        title: evt.title,
        detail: evt.detail,
        date: daysFromNow(-evt.daysAgo),
      });
    }
    kase.timeline.sort((a, b) => a.date.localeCompare(b.date));
    return kase;
  });
}
