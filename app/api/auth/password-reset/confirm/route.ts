import { NextResponse } from "next/server";
import { badRequest } from "@/lib/server/auth";
import { completePasswordReset } from "@/lib/server/password-reset";
import { passwordResetConfirmSchema } from "@/lib/schemas";

/** Set a new password using a one-time link. Signs out every existing session. */
export async function POST(request: Request) {
  const parsed = passwordResetConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const result = await completePasswordReset(parsed.data.token, parsed.data.newPassword);
  if (!result.ok) {
    return NextResponse.json(
      { error: "This reset link is invalid, already used, or expired. Request a new one." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
