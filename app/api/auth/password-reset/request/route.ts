import { NextResponse } from "next/server";
import { badRequest } from "@/lib/server/auth";
import { passwordResetAvailable, requestPasswordReset } from "@/lib/server/password-reset";
import { passwordResetRequestSchema } from "@/lib/schemas";

/**
 * Ask for a password-reset link. The response is identical whether or not
 * the address has an account, so this can't be used to discover who is a
 * customer. Rate-limited per IP by the middleware and per address here.
 */
export async function POST(request: Request) {
  if (!passwordResetAvailable()) {
    return NextResponse.json({ error: "Password reset by email isn't available. Contact support." }, { status: 503 });
  }
  const parsed = passwordResetRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  await requestPasswordReset(parsed.data.email);
  return NextResponse.json({
    ok: true,
    message: "If an account uses that email, a reset link is on its way. It expires in 30 minutes.",
  });
}
