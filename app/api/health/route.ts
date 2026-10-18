import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and load balancers: is the app up, and
 * can it reach its database. Public and unauthenticated, so it reports only
 * those two facts — no version, configuration, or usage data.
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
      database,
      timestamp: new Date().toISOString(),
    },
    { status: database === "connected" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
