import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { ticketInclude, ticketToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { createTicketInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createTicketInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { caseId, category, subject, body } = parsed.data;

  // Audit fix, now server-enforced: a ticket may only reference a case the
  // requester can access; anything else is silently dropped to null.
  let relatedCaseId: string | null = null;
  if (caseId) {
    const kase = await prisma.case.findUnique({ where: { id: caseId } });
    if (kase && (user.role === "admin" || kase.userId === user.id)) relatedCaseId = kase.id;
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      caseId: relatedCaseId,
      category,
      subject,
      status: "open",
      messages: {
        create: { authorRole: "customer", authorName: user.name, body },
      },
    },
    include: ticketInclude,
  });

  const notifications = await queueNotification(
    user.id,
    "support_update",
    `Ticket received: ${subject}`,
    "We've logged your support request. You'll hear back based on your service package.",
  );

  return NextResponse.json({
    ticket: ticketToDomain(ticket, { includeInternalNotes: user.role === "admin" }),
    notifications,
  });
}
