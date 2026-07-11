import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { ticketInclude, ticketToDomain } from "@/lib/server/serializers";
import { queueNotification } from "@/lib/server/notify";
import { ticketActionSchema } from "@/lib/schemas";
import type { NotificationEvent } from "@/lib/types";

/**
 * Ticket mutations. Customers may add messages to their own tickets; status
 * changes and internal notes are staff-only. The message author role is
 * derived from the session — customers can never post as staff.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const isAdmin = user.role === "admin";

  const parsed = ticketActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const action = parsed.data;

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || (!isAdmin && ticket.userId !== user.id)) return notFound("Ticket not found.");

  const notifications: NotificationEvent[] = [];

  switch (action.type) {
    case "add_message": {
      const authorRole = isAdmin ? "staff" : "customer";
      await prisma.supportTicket.update({
        where: { id },
        data: {
          updatedAt: new Date(),
          // A staff reply on an open ticket flips it to waiting-on-customer.
          ...(authorRole === "staff" && ticket.status === "open" && { status: "waiting_on_customer" }),
          messages: { create: { id: action.id, authorRole, authorName: user.name, body: action.body } },
        },
      });
      if (authorRole === "staff") {
        notifications.push(
          ...(await queueNotification(
            ticket.userId,
            "support_update",
            `Reply on: ${ticket.subject}`,
            "BureauOS support replied to your ticket.",
          )),
        );
      }
      break;
    }

    case "set_status": {
      if (!isAdmin) return forbidden("Staff only.");
      await prisma.supportTicket.update({
        where: { id },
        data: { status: action.status, updatedAt: new Date() },
      });
      notifications.push(
        ...(await queueNotification(
          ticket.userId,
          "support_update",
          `Ticket ${action.status.replace(/_/g, " ")}: ${ticket.subject}`,
          "Your support ticket status was updated.",
        )),
      );
      break;
    }

    case "add_internal_note": {
      if (!isAdmin) return forbidden("Staff only.");
      await prisma.adminNote.create({
        data: { id: action.id, ticketId: id, authorName: user.name, body: action.body },
      });
      break;
    }
  }

  const updated = await prisma.supportTicket.findUniqueOrThrow({ where: { id }, include: ticketInclude });
  return NextResponse.json({
    ticket: ticketToDomain(updated, { includeInternalNotes: isAdmin }),
    notifications,
  });
}
