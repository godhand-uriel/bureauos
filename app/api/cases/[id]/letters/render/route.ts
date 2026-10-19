import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { badRequest, forbidden, getSessionUser, notFound, unauthorized } from "@/lib/server/auth";
import { letterAccess } from "@/lib/server/letter-access";
import { getLetterRenderer } from "@/lib/server/letters";
import { getNavigator } from "@/lib/navigators";
import { renderLetterInputSchema } from "@/lib/schemas";
import { parseDateOnly, todayUtc, diffDays } from "@/lib/dates";

/**
 * Render a letter from a template. The letter text exists only on the server
 * (lib/server/letters.ts), so the entitlement check here is authoritative: a
 * case in a paid navigator without an active Case Pass gets 402, whatever the
 * client believes. Staff rendering on a customer's case uses the customer's
 * name as the sender.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const parsed = renderLetterInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const kase = await prisma.case.findUnique({ where: { id }, include: { user: true } });
  if (!kase || (user.role !== "admin" && kase.userId !== user.id)) return notFound("Case not found.");

  const template = getNavigator(kase.navigatorSlug)?.letterTemplates.find(
    (t) => t.id === parsed.data.templateId,
  );
  const render = getLetterRenderer(kase.navigatorSlug, parsed.data.templateId);
  if (!template || !render) return notFound("Letter template not found.");

  const access = await letterAccess(user, kase);
  if (!access.ok) {
    if (access.status === 402) {
      return NextResponse.json({ error: access.error, code: "case_pass_required" }, { status: 402 });
    }
    return forbidden(access.error);
  }

  // Letter date: the writer's own calendar date if supplied and plausible
  // (within a day of server time), otherwise the server's.
  const serverToday = todayUtc();
  const local = parsed.data.localDate;
  const dateOnly = local && parseDateOnly(local) && Math.abs(diffDays(serverToday, local)) <= 1 ? local : serverToday;
  const p = parseDateOnly(dateOnly)!;
  const todayLong = new Date(Date.UTC(p.y, p.m - 1, p.d, 12)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  // Only the template's own fields are passed through.
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    const value = parsed.data.values[field.id]?.trim();
    if (value) values[field.id] = value;
  }

  const body = render(values, {
    senderName: kase.user.name,
    todayLong,
    caseTitle: kase.title,
  });
  return NextResponse.json({ title: template.name, body });
}
