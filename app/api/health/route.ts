import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

/**
 * Health check: app status + database connectivity. No secrets, no counts
 * that could leak usage data publicly beyond a boolean reachability signal.
 *
 * Production API structure (each backed by Prisma + session auth):
 *   /api/auth/*            → signup, login, demo, logout (demo-grade sessions)
 *   /api/bootstrap         → session-scoped data load
 *   /api/cases[…]          → case CRUD + validated action mutations
 *   /api/tickets[…]        → support tickets
 *   /api/reviews[…]        → professional review workflow
 *   /api/files[…]          → file metadata (bytes not stored in Phase 1)
 *   /api/billing           → simulated subscription changes (Stripe later)
 *   /api/acceptances       → versioned disclaimer acceptances
 *   /api/me[…]             → profile + notification preferences
 */
export async function GET() {
  let database: "connected" | "unreachable" = "unreachable";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    // fall through with "unreachable"
  }

  return NextResponse.json(
    {
      status: database === "connected" ? "ok" : "degraded",
      service: "bureauos",
      mode: "local-demo",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: database === "connected" ? 200 : 503 },
  );
}
