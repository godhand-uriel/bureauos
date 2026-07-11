import type { PrismaClient } from "@prisma/client";
import { buildSeedCases } from "@/lib/seed";
import { caseToCreateData } from "@/lib/server/serializers";
import { hashPassword } from "@/lib/server/passwords";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEMO_ADMIN_EMAIL,
  DEMO_CUSTOMER_EMAIL,
  DEMO_PASSWORD,
  DISCLAIMER_VERSION,
} from "@/lib/constants";
import { daysFromNow, uid } from "@/lib/utils";

/**
 * Seeds the database with the demo accounts and demo data:
 *  - customer  demo@bureauos.app  (4 realistic cases, Assisted Review plan)
 *  - admin     admin@bureauos.app
 * plus one support ticket, one in-review request, file metadata, disclaimer
 * acceptances, and welcome notifications — the same "lived-in" state the
 * localStorage demo used to build client-side.
 *
 * Idempotent: skips if the demo customer already exists (unless wiped first).
 */
export async function seedDatabase(prisma: PrismaClient): Promise<{ seeded: boolean }> {
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

  // Demo cases come from the same content + rule engine the app uses.
  const seedCases = buildSeedCases(customer.id, "assisted_review");
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

  await prisma.subscription.create({
    data: {
      userId: customer.id,
      tier: "assisted_review",
      status: "active",
      startedAt: new Date(daysFromNow(-30)),
      payments: {
        create: [
          { label: "Assisted Review — monthly (simulated)", amountLabel: "$29.00", kind: "mock_charge", createdAt: new Date(daysFromNow(-30)) },
          { label: "Assisted Review — monthly (simulated)", amountLabel: "$29.00", kind: "mock_charge", createdAt: new Date(daysFromNow(-1)) },
        ],
      },
    },
  });

  if (insurance) {
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
            body: "Good question — send the written request first and keep proof of delivery. Code enforcement is the escalation if the landlord stays silent past a reasonable window (your plan flags ~14 days for a major repair). Want us to look over your letter draft before you send it? If yes, reply here and attach it to the case.",
            createdAt: new Date(daysFromNow(-1)),
          },
        ],
      },
      internalNotes: {
        create: {
          authorName: admin.name,
          body: "Customer is on Assisted Review — offer a letter check-in before escalation advice goes further.",
          createdAt: new Date(daysFromNow(-1)),
        },
      },
    },
  });

  const files = [
    tenant && { caseId: tenant.id, name: "ceiling-leak-photo-1.jpg", fileType: "image/jpeg", sizeLabel: "2.1 MB", category: "repair_photos", status: "verified", notes: "Water stain, bathroom ceiling — dated in frame.", uploadedAt: new Date(daysFromNow(-9)) },
    tenant && { caseId: tenant.id, name: "lease-2025-signed.pdf", fileType: "application/pdf", sizeLabel: "840 KB", category: "lease_documents", status: "verified", notes: "", uploadedAt: new Date(daysFromNow(-9)) },
    insurance && { caseId: insurance.id, name: "meridian-denial-letter.pdf", fileType: "application/pdf", sizeLabel: "312 KB", category: "insurance_denial_letters", status: "pending_review", notes: "Full EOB, 3 pages.", uploadedAt: new Date(daysFromNow(-6)) },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));
  await prisma.uploadedFile.createMany({
    data: files.map((f) => ({ ...f, userId: customer.id })),
  });

  await prisma.notificationEvent.createMany({
    data: [
      { userId: customer.id, type: "welcome", channel: "email", subject: "Welcome to BureauOS", body: "Your account is set up. Start a case any time — your dashboard keeps everything organized.", status: "mock_sent" },
      { userId: customer.id, type: "review_update", channel: "email", subject: "Your review is in progress", body: "A reviewer is examining your MRI claim denial case file.", status: "mock_sent" },
    ],
  });

  return { seeded: true };
}

/** Deletes all rows (dev/demo reset). Order handled by cascade from User. */
export async function wipeDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.user.deleteMany({});
}
