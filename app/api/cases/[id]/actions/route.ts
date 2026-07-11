import { NextResponse } from "next/server";
import { badRequest, getSessionUser, unauthorized } from "@/lib/server/auth";
import { performCaseAction } from "@/lib/server/case-actions";
import { caseActionSchema } from "@/lib/schemas";

/**
 * Single validated mutation endpoint per case. The action union keeps every
 * write behind one ownership check + per-action rules (see case-actions.ts).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const parsed = caseActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const result = await performCaseAction(user, id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ case: result.case, notifications: result.notifications });
}
