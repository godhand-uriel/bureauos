import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/server/notify";
import { queueDeadlineReminders } from "@/lib/server/reminders";

export const dynamic = "force-dynamic";

/**
 * Scheduled notification runner: queue any deadline reminders that are due,
 * then deliver (or retry) queued email. Call it every 15 minutes from the
 * host's scheduler with `Authorization: Bearer $CRON_SECRET` — GET for
 * schedulers that only issue GETs (e.g. Vercel Cron), POST for the rest.
 *
 * Machine-to-machine: excluded from session and origin checks in
 * middleware.ts; authenticated only by the secret. Without CRON_SECRET it is
 * switched off (503), never open.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  // Compare digests so the comparison is constant-time whatever the lengths.
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();
  return presented.length > 0 && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if ((process.env.CRON_SECRET ?? "").length < 16) {
    return NextResponse.json({ error: "The notification runner is not configured." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const remindersQueued = await queueDeadlineReminders();
  const delivery = await drainNotifications();
  return NextResponse.json({ ok: true, remindersQueued, ...delivery });
}

export const GET = run;
export const POST = run;
