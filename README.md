# BureauOS

**Bureaucracy is a system. Now you have one too.**

BureauOS is a public-facing bureaucracy navigation and customer-service platform. It turns
overwhelming life-administration problems — DMV issues, job separation, small business
compliance, insurance denials, veteran benefits, tenant rights — into organized cases with
guided intake, personalized action plans, document checklists, deadline tracking, letter
generation, file organization, support tickets, and an operator console for the BureauOS team.

> BureauOS is not a law firm and does not provide legal advice. It helps users organize
> information, understand common process steps, and prepare next actions — and it says so
> everywhere it matters, with tracked disclaimer acceptance before plans, letters, or reviews.

## Quick start

```bash
cp .env.example .env    # Windows: Copy-Item .env.example .env
npm install
npm run db:migrate      # apply Prisma migrations (SQLite at prisma/dev.db)
npm run db:seed         # load the demo accounts + demo cases
npm run dev             # http://localhost:3000
```

Checks and production build:

```bash
npm run typecheck
npm test            # RBAC/ownership integration tests (dedicated test db)
npm run lint
npm run build
npm start
```

Database scripts: `db:migrate` (apply committed migrations), `db:migrate:dev` (create a new
migration after schema changes), `db:generate` (regenerate the Prisma client), `db:seed`
(idempotent demo seed).

**Two env vars are required** (see `.env.example`): `DATABASE_URL` (SQLite locally) and
`AUTH_SECRET` (any random 64-hex string; generate with `openssl rand -hex 32`).

> Tips for OneDrive-synced folders: OneDrive can occasionally lock files in `.next` (spurious
> `PageNotFoundError` — delete `.next` and rebuild; don't run `next dev` and `next build`
> simultaneously). If SQLite locking misbehaves, point `DATABASE_URL` at a path outside the
> synced folder.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer (4 seeded cases, Assisted Review plan) | `demo@bureauos.app` | `bureau-demo` |
| Admin / operator | `admin@bureauos.app` | `bureau-demo` |

One-click demo buttons on `/login` (and the in-app sign-in gate) log you into either account.
You can also sign up a fresh customer account — data is per-browser (localStorage).

## The six navigators

| Navigator | Handles |
|---|---|
| **DMV** | License suspensions, registration problems, lost documents, reinstatement |
| **Job Separation** | Fired/laid off/quit, unemployment prep, final paycheck, COBRA |
| **Small Business Compliance** | Formation, licenses/permits, tax registrations, annual filings |
| **Insurance Denial** | Denial intake, reason tracking, appeal letters, appeal deadlines |
| **Veteran Benefits** | VA claim prep, evidence checklist, appointment/document tracking |
| **Tenant Rights** | Repairs, deposits, notices, landlord communication timeline |

## Customer flow

1. **Land & learn** — `/` marketing page, `/pricing` service packages, `/legal/*` terms/privacy/disclaimer
2. **Account** — `/signup`, `/login`, or one-click demo mode
3. **Get routed** — `/assistant` (rule-based chat) or browse `/navigators`
4. **Start a case** — `/cases/new?navigator=[slug]`, guided intake with saved progress
5. **Accept disclaimers** — one-time versioned acceptance gates plans, letters, and reviews
6. **Work the case** — action plan, tasks, document checklist + file attachments, letters,
   deadlines, timeline, jurisdiction notes
7. **Get help** — `/support` tickets, `/cases/[id]/review` professional review,
   `/checkout` + `/billing` for service packages, `/settings/notifications` preferences

## Operator flow (`/admin`, staff accounts only)

- Overview: open cases, high-priority queue, incomplete intakes, missing required documents,
  review queue, open tickets, files awaiting verification, 14-day deadline watch
- Case detail: status updates, assignment, internal notes (never shown to customers),
  file verification, letters, full timeline
- `/admin/reviews`: review-request queue with status workflow + customer-visible reviewer notes
- `/admin/support`: ticket queue, staff replies, status updates, internal notes

## What is mocked vs. real

| Layer | Local MVP (today) | Production path |
|---|---|---|
| Database | **Real** — Prisma + SQLite behind validated API routes; server is the source of truth | Switch provider to Postgres (Supabase/Neon/RDS); see `docs/backend_migration_plan.md` |
| Authorization | **Real** — server-side owner scoping + role checks on every route; staff-only notes stripped from customer responses; locked in by a 23-test integration suite (`npm test`) | Run the suite in CI on every push |
| Audit trail | **Real** — append-only `AuditLog` for staff actions, read-only admin view on `/admin` | DB-role immutability once on Postgres |
| Auth | **Real framework** — Auth.js (NextAuth v5) credentials + JWT sessions, middleware-enforced, CSRF-protected, rate-limited | Remove demo accounts; optionally swap credentials for a hosted provider (Clerk/Supabase); add MFA |
| Payments | Simulated checkout (`/api/billing` records mock entries), clearly labeled | Stripe Checkout + verified webhooks; tiers map 1:1 to Stripe prices |
| File uploads | Metadata rows in the DB; bytes never leave the device, labeled in UI | Presigned uploads to S3 / Supabase Storage / R2 / GCS (`storageKey` reserved) |
| Notifications | Server-side mock outbox honoring prefs (visible in `/settings/notifications`) | Resend/SendGrid/Postmark + Twilio/SNS/SES workers draining the same event rows |
| AI assistant | Deterministic rule-based provider (no keys needed) | Same `AssistantProvider` interface backed by Anthropic/OpenAI/OpenRouter |
| Jurisdiction rules | Code-defined samples (CA, TX, WA, FL, federal) with per-rule disclaimers | Maintained dataset with editorial review |

The UI never claims a mocked service is live. Full ledger: `docs/production_readiness.md`.

## Architecture

```
app/
  page.tsx, pricing/, legal/*          Public pages (marketing shell)
  login/, signup/                      Auth screens (demo-grade sessions)
  api/                                 Zod-validated route handlers (source of truth)
    auth/*, bootstrap/, cases/*, tickets/*, reviews/*, files/*,
    billing/, acceptances/, me/*, dev/reset/, health/
  (app)/                               Authenticated app (sidebar shell + auth gate)
    dashboard/, assistant/, navigators/, cases/, support/, billing/,
    checkout/, settings/, settings/notifications/
    admin/                             Staff-only console (role-gated, server-enforced)
components/                            Product components + ui/ primitives
lib/
  types.ts, schemas.ts                 Domain model + Zod validation (client + API inputs)
  constants.ts                         Shared client/server constants
  store.ts                             Client cache over the API (v3) — same selectors as ever
  server/                              db, auth/sessions, serializers, case actions, notify, seed
  plan-engine.ts                       Rule-based action plan engine (runs server-side)
  packages.ts                          Service tiers (Stripe-shaped)
  jurisdictions.ts                     Jurisdiction rules framework + samples
  assistant.ts                         AssistantProvider interface + rule-based provider
  navigators/                          Six navigator content modules
  seed.ts                              Demo case content (used by the DB seed)
prisma/
  schema.prisma                        ACTIVE schema (SQLite; Postgres-ready)
  migrations/, seed.ts                 Migrations + demo seed script
```

**Swap-point discipline.** Components only talk to store actions and selectors; the store talks
only to the API; routes talk only to `lib/server/*`. Auth, billing, storage, notifications, and
the assistant each remain behind a small interface with the production provider documented at
the swap point.

## Production upgrade path

1. ~~**Database** — move persistence behind API routes with Prisma~~ **Done (Phase 1)** — SQLite
   locally; switch the provider to Postgres for hosting (`docs/backend_migration_plan.md`).
2. ~~**Auth** — replace demo sessions with Auth.js; enforce sessions in middleware~~ **Done
   (Phase 2)** — remaining: remove demo accounts before external exposure; optional hosted
   provider swap; MFA for staff.
3. **Payments** — create Stripe products for the four tiers; replace `/checkout` with Stripe
   Checkout; handle `checkout.session.completed` + subscription webhooks (verify signatures).
4. **Storage** — presigned upload endpoint; store object keys (schema already has `storageKey`).
5. **Notifications** — worker that drains `NotificationEvent` rows through Resend/Twilio.
6. **Assistant** — API route implementing `AssistantProvider` with a real model.
7. **Deploy** — Vercel or any Node host; set env vars from `.env.example`; `npm run build`.

## Security notes for production

- **Authentication**: managed provider (Clerk/Supabase/Auth.js); never ship the demo hash. MFA for staff.
- **Authorization / RBAC**: owner-scoping and the customer/admin split are now enforced
  server-side on every API route; add integration tests and audit logging on top.
- **Data encryption**: TLS everywhere; encryption at rest for DB and file storage. Case data is
  sensitive PII (housing, health, employment, benefits).
- **Secure file storage**: private buckets, presigned URLs with short TTLs, content-type validation,
  AV scanning on upload.
- **Audit logging**: append-only log of staff actions (status changes, note access, file views).
- **Rate limiting**: on auth, ticket creation, file presigning, and the assistant endpoint.
- **Webhook verification**: verify Stripe signatures; idempotent handlers.
- **PII protection**: field-level minimization, data retention policy, export + delete endpoints.
- **Backups**: automated DB backups with tested restores.
- **Terms/privacy compliance**: replace the demo legal pages with counsel-reviewed documents;
  keep versioned acceptance records (already modeled in `DisclaimerAcceptance`).

## Known limitations

- Demo accounts use a published shared password by design; rate limiting is in-memory
  (per-process) — both fine locally, both must change before external exposure
- Data lives in a local SQLite file; earlier localStorage-era accounts/cases are not migrated
- Failed background writes log a console warning; a page refresh restores server truth
- File bytes stay on-device (metadata rows only)
- Checkout/billing/notifications are simulations, labeled as such in the UI
- Jurisdiction rules are illustrative samples, not a maintained legal dataset
- The assistant is keyword-routing, not a language model

More detail: `docs/production_readiness.md` and `docs/backend_migration_plan.md`.
