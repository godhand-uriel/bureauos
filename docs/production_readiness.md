# BureauOS Production Readiness

Date: 2026-07-11 (post Phase 3 operations hardening)

**BureauOS is NOT production-ready.** This document is the honest ledger of
what is real, what is demo-grade, and what must happen before real customers
or real PII touch the system.

## Current state by layer

| Layer | State | Production-ready? |
|---|---|---|
| Persistence | Prisma + SQLite behind API routes; server is source of truth | Partially — needs Postgres, backups, migrations discipline |
| Authorization | Server-side owner scoping + role checks on every route; staff-only fields stripped from customer responses; middleware role gate on /admin | Yes for current scope — locked in by the 23-test integration suite (`npm test`) |
| Audit logging | Append-only `AuditLog` written server-side for all staff actions; admin read-only view; no app update/delete path | Yes for current scope — DB-level immutability guarantees come with Postgres roles |
| Testing | RBAC/ownership/sanitization integration tests against a dedicated test DB; CI-ready (`npm test`) | Partially — add CI wiring + customer-flow e2e tests |
| Authentication | Auth.js (NextAuth v5) credentials provider, scrypt hashes, signed/encrypted JWT sessions, middleware enforcement | Framework is production-grade; **demo accounts + shared password must go**, MFA missing |
| CSRF | Auth.js token on auth endpoints; same-origin check + SameSite=Lax on all other mutations | Yes for current scope |
| Rate limiting | Per-IP sliding window in middleware (auth 20/min, mutations 120/min) | Partially — in-memory per instance; needs shared store (Redis) for multi-node |
| Input validation | Zod on every API boundary | Yes (extend as routes grow) |
| Payments | Simulated (`/api/billing` records mock entries; UI labeled) | **No** — Stripe + verified webhooks |
| File storage | Metadata only; bytes never leave the user's device; UI labeled | **No** — presigned encrypted object storage + scanning |
| Notifications | Queued→transport pipeline honoring preferences; MockTransport delivers inline, nothing sent | **No** — swap MockTransport for Resend/Twilio and move delivery to a worker |
| Assistant | Local rule-based routing, no external calls | N/A for now |
| Legal documents | Placeholders; versioned acceptance tracking is real and server-stored | **No** — counsel review required |
| Secrets | Only `DATABASE_URL`; `.env` gitignored; no secrets in client code | Yes for current scope |
| Health | `/api/health` reports app status, mode, db connectivity, timestamp | Yes for current scope |

## Demo-only surfaces (must be removed/replaced before launch)

- Demo accounts (`demo@bureauos.app`, `admin@bureauos.app`, published shared
  password) and the demo seed-ensure endpoint (`/api/auth/demo`).
- `/api/dev/reset` (database wipe/reseed; refused in production builds unless
  `BUREAUOS_ALLOW_RESET=true`).
- Seeded demo cases/tickets/reviews/files.
- Simulated checkout copy and mock billing history.

## Security checklist for production

- [x] Real authentication framework (Auth.js credentials + JWT sessions) —
      still needed: remove demo accounts, add MFA for staff
- [x] CSRF protection (Auth.js tokens + same-origin checks) and SameSite=Lax
      session policy
- [x] Rate limiting on auth + mutation routes — still needed: shared store for
      multi-instance deploys
- [x] Row-level ownership tests + RBAC integration tests (`npm test`, 23
      tests) — still needed: run them in CI on every push
- [x] Append-only audit log for staff actions (status changes, notes, file
      verification, review decisions) — still needed: DB-role enforcement of
      immutability once on Postgres
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
