# BureauOS Production Readiness

Date: 2026-07-09 (post Phase 1 backend migration)

**BureauOS is NOT production-ready.** This document is the honest ledger of
what is real, what is demo-grade, and what must happen before real customers
or real PII touch the system.

## Current state by layer

| Layer | State | Production-ready? |
|---|---|---|
| Persistence | Prisma + SQLite behind API routes; server is source of truth | Partially — needs Postgres, backups, migrations discipline |
| Authorization | Server-side owner scoping + role checks on every route; staff-only fields stripped from customer responses | Directionally yes — needs tests + audit logging |
| Authentication | Demo-grade: scrypt password hash, random-token cookie sessions | **No** — replace with Clerk/Supabase Auth/Auth.js |
| Input validation | Zod on every API boundary | Yes (extend as routes grow) |
| Payments | Simulated (`/api/billing` records mock entries; UI labeled) | **No** — Stripe + verified webhooks |
| File storage | Metadata only; bytes never leave the user's device; UI labeled | **No** — presigned encrypted object storage + scanning |
| Notifications | Server-side mock outbox honoring preferences; nothing delivered | **No** — Resend/Twilio/SES worker |
| Assistant | Local rule-based routing, no external calls | N/A for now |
| Legal documents | Placeholders; versioned acceptance tracking is real and server-stored | **No** — counsel review required |
| Secrets | Only `DATABASE_URL`; `.env` gitignored; no secrets in client code | Yes for current scope |
| Health | `/api/health` reports app status, mode, db connectivity, timestamp | Yes for current scope |

## Demo-only surfaces (must be removed/replaced before launch)

- Demo accounts (`demo@bureauos.app`, `admin@bureauos.app`, shared password)
  and the one-click demo login endpoint (`/api/auth/demo`).
- `/api/dev/reset` (database wipe/reseed; refused in production builds unless
  `BUREAUOS_ALLOW_RESET=true`).
- Seeded demo cases/tickets/reviews/files.
- Simulated checkout copy and mock billing history.

## Security checklist for production (unchanged priorities)

- [ ] Real authentication provider; MFA for staff accounts
- [ ] CSRF protection and strict same-site session policy
- [ ] Rate limiting (auth, ticket creation, mutation routes, assistant)
- [ ] Row-level ownership tests + RBAC integration tests in CI
- [ ] Append-only audit log for staff actions (status changes, notes, file
      verification, review decisions)
- [ ] Postgres with encryption at rest, automated backups, tested restores
- [ ] Secure file storage: private buckets, presigned short-TTL URLs,
      content-type validation, malware scanning
- [ ] Stripe webhook signature verification; idempotent handlers
- [ ] PII lifecycle: minimization, retention policy, export + delete endpoints
- [ ] Counsel-reviewed terms/privacy/disclaimer (acceptance plumbing already
      records user, case, version, timestamp server-side)
- [ ] Structured logging + error monitoring; remove console-warn reconciliation
- [ ] Dependency audit (npm audit findings) resolved or risk-accepted

## What Phase 1 actually bought

Before Phase 1, every security property was fictional: any user could read any
data by editing localStorage. Now:

- ownership is enforced where it counts (the server), per request;
- customers cannot reach admin data through any API path (verified: admin
  routes and admin-only actions return 401/403/404 for customer sessions);
- staff-only notes never appear in customer payloads;
- disclaimer acceptances, billing state, tickets, reviews, and admin notes
  survive browser data clearing and are attributable to real rows;
- the API surface is now integration-testable without a browser.

That is the foundation the checklist above builds on — necessary, not
sufficient.
