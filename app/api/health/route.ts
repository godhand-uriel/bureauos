import { NextResponse } from "next/server";

/**
 * Health check — the seed of the production API layer.
 *
 * Production API structure (each backed by Prisma + real auth):
 *   /api/auth/*          → Clerk / Supabase Auth / Auth.js handlers
 *   /api/cases           → case CRUD (owner-scoped)
 *   /api/cases/[id]/*    → tasks, documents, letters, deadlines, timeline
 *   /api/files/presign   → presigned uploads (S3 / Supabase Storage / R2)
 *   /api/tickets         → support tickets
 *   /api/reviews         → professional review workflow
 *   /api/stripe/webhook  → subscription lifecycle (signature-verified)
 *   /api/notifications   → outbox worker hooks (Resend / Twilio / SES)
 *
 * All inputs validated with the Zod schemas in lib/schemas.ts.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "bureauos",
    mode: "local-demo",
    timestamp: new Date().toISOString(),
  });
}
