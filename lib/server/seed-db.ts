import type { PrismaClient } from "@prisma/client";
import { buildSeedCases } from "@/lib/seed";
import { caseToCreateData } from "@/lib/server/serializers";
import { hashPassword } from "@/lib/server/passwords";
import { humanReviewEnabled } from "@/lib/server/commerce";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEMO_ADMIN_EMAIL,
  DEMO_CUSTOMER_EMAIL,
  DEMO_PASSWORD,
  DISCLAIMER_VERSION,
} from "@/lib/constants";
import { daysFromNow, uid } from "@/lib/utils";

/**
 * DEVELOPMENT ONLY. Seeds the database with the demo accounts and demo data:
 *  - customer  demo@bureauos.app  (realistic cases, self-service)
 *  - admin     admin@bureauos.app
 * plus one support ticket, disclaimer acceptances, and a welcome
 * notification. No purchases or entitlements are seeded: the demo customer
 * goes through the Case Pass purchase flow like anyone else.
 *
 * Idempotent: skips if the demo customer already exists (unless wiped first).
 */
export async function seedDatabase(prisma: PrismaClient): Promise<{ seeded: boolean }> {
  // Defense in depth: every caller already refuses in production, but the
  // demo accounts carry a published password, so the seed itself refuses too.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo data must never be seeded in production.");
  }
  const existing = await prisma.user.findUnique({ where: { email: DEMO_CUSTOMER_EMAIL } });
  if (existing) return { seeded: false };

  const customer = await prisma.user.create({
    data: {
      email: DEMO_CUSTOMER_EMAIL,
      name: "Jordan Avery",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "customer",
      usState: "California",
      notificationPrefs: { create: { ...DEFAULT_NOTIFICATION_PREFS } },
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: DEMO_ADMIN_EMAIL,
      name: "Alex Reyes",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "admin",
      notificationPrefs: { create: { ...DEFAULT_NOTIFICATION_PREFS } },
    },
  });

  // Demo cases come from the same content + rule engine the app uses. The
  // human-assisted tier and its review request are only seeded when that
  // service is switched on, so the demo never shows a service that is off.
  const humanReview = humanReviewEnabled();
  const seedCases = buildSeedCases(customer.id, humanReview ? "assisted_review" : "self_service");
  const insurance = seedCases.find((c) => c.navigatorSlug === "insurance-denial");
  const tenant = seedCases.find((c) => c.navigatorSlug === "tenant-rights");
  if (insurance) {
    insurance.assignedTo = "Alex Reyes";
    insurance.adminNotes = [
      {
        id: uid(),
        authorName: "Alex Reyes",
        body: "Denial letter cites MN-204. Policy excerpt supports the appeal — PT-first prerequisite was met. Waiting on provider support letter before review can complete.",
        createdAt: daysFromNow(-2),
      },
    ];
  }
  for (const kase of seedCases) {
    await prisma.case.create({ data: caseToCreateData(kase) });
  }

  // Global + per-case disclaimer acceptances so seeded flows work end-to-end.
  await prisma.disclaimerAcceptance.createMany({
    data: [null, ...seedCases.map((c) => c.id)].map((caseId) => ({
      userId: customer.id,
      caseId,
      version: DISCLAIMER_VERSION,
      acceptedTerms: true,
      acceptedPrivacy: true,
      acceptedDisclaimer: true,
      acceptedAt: new Date(daysFromNow(-30)),
    })),
  });

  if (insurance && humanReview) {
    await prisma.reviewRequest.create({
      data: {
        caseId: insurance.id,
        userId: customer.id,
        status: "in_review",
        customerNotes:
          "Please check whether my appeal letter addresses the 'not medically necessary' reason strongly enough, and whether I'm missing any evidence before I send it.",
        requestedAt: new Date(daysFromNow(-3)),
        reviewerNotes: {
          create: {
            authorName: "Alex Reyes",
            body: "Letter structure is solid. Flagging: needs the treating physician's letter of medical necessity before submission.",
            createdAt: new Date(daysFromNow(-1)),
          },
        },
      },
    });
  }

  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      caseId: tenant?.id ?? null,
      category: "case_help",
      subject: "Should I send the repair letter before or after calling code enforcement?",
      status: "waiting_on_customer",
      createdAt: new Date(daysFromNow(-2)),
      messages: {
        create: [
          {
            authorRole: "customer",
            authorName: customer.name,
            body: "My landlord ignored two texts about the ceiling leak. The plan says to send the written request first, but a neighbor said to call code enforcement right away. Which order is right?",
            createdAt: new Date(daysFromNow(-2)),
          },
          {
            authorRole: "staff",
            authorName: admin.name,
            body: "Thanks for reaching out. We can't tell you which step is right for your situation — that's legal advice, and a local tenant hotline or legal aid office can give it for free. What we can say is how the tools work: your plan lists the written request first because a dated letter creates the record most later steps rely on. Reply here if anything in the app isn't working the way you expect.",
            createdAt: new Date(daysFromNow(-1)),
          },
        ],
      },
      internalNotes: {
        create: {
          authorName: admin.name,
          body: "Second follow-up from this customer on the same leak — check back in a week if no reply.",
          createdAt: new Date(daysFromNow(-1)),
        },
      },
    },
  });

  await prisma.notificationEvent.createMany({
    data: [
      { userId: customer.id, type: "welcome", channel: "email", subject: "Welcome to BureauOS", body: "Your account is set up. Start a case any time — your dashboard keeps everything organized.", status: "mock_sent" },
      ...(humanReview
        ? [{ userId: customer.id, type: "review_update", channel: "email", subject: "Your review is in progress", body: "A reviewer is examining your MRI claim denial case file.", status: "mock_sent" }]
        : []),
    ],
  });

  return { seeded: true };
}

/**
 * Deletes all rows (development reset and test setup only — the reset route
 * is 404 in production). Most tables cascade from User; purchases and the
 * Stripe event ledger deliberately outlive their user, so they go explicitly.
 */
export async function wipeDatabase(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The database must never be wiped in production.");
  }
  await prisma.user.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.stripeEvent.deleteMany({});
}
