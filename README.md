# BureauOS

**Bureaucracy is a system. Now you have one too.**

BureauOS turns a life-admin problem into an organized case: guided intake, an action plan,
source-backed deadline tracking, checklists, letters, and a dated timeline.

The **Job Separation Navigator** is the launch product. Its deadline calculations cover Florida
unemployment appeals, federal COBRA elections, and Marketplace enrollment. Five more navigators
(DMV, Small Business, Insurance Denial, Veteran Benefits, Tenant Rights) are available as
**previews**: free organizing tools with no verified deadline rules and nothing for sale.

> BureauOS is self-service software, not a law firm. It gives no legal advice, files nothing on
> anyone's behalf, and promises no outcome, and the product says so wherever it matters.
> Acceptance of the terms is recorded, per case and per version, before plans or letters are
> produced.

## What's free, and what's sold

| Free, every case | Job Separation Case Pass (one-time, per case, default $29) |
|---|---|
| Guided intake, action plan, risk flags | Letter generator: final-paycheck follow-up, COBRA information request, unemployment appeal statement |
| Deadline tracking, with each rule, its source, and NEEDS VERIFICATION wherever a date isn't established | Letters prefilled from intake, editable, unlimited saves |
| Task and document checklists, timeline, support tickets, deadline reminder emails | |

Payment goes through Stripe-hosted Checkout. A verified Stripe webhook is the only way a Case Pass
becomes active (a browser redirect never activates one). The letter text lives only on the server,
and every render or save is entitlement-checked. Human-assisted review is **not offered**: it stays
off unless `BUREAUOS_HUMAN_REVIEW_ENABLED=true`. There is no file upload: BureauOS never stored
file contents, and the old metadata-only panel was removed rather than left looking like an upload.

## Quick start (development)

```bash
cp .env.example .env    # Windows: Copy-Item .env.example .env
npm install             # also generates the Prisma client for your DATABASE_URL
npm run db:migrate      # apply migrations (SQLite by default)
npm run db:seed         # demo accounts + demo cases (refuses to run in production)
npm run dev             # http://localhost:3000
```

Development-only demo accounts (they are refused at sign-in in production, and demo login is
removed from production builds):

| Role | Email | Password |
|---|---|---|
| Customer | `demo@bureauos.app` | `bureau-demo` |
| Staff | `admin@bureauos.app` | `bureau-demo` |

Without Stripe keys, the checkout page offers a clearly labelled **development-only** "simulate a
payment" button. That route returns 404 in production. Without Resend, development email goes to a
local outbox and the server log.

> OneDrive/Dropbox can lock `.next` or the SQLite file. Delete `.next` and rebuild, and don't run
> `next dev` and `next build` at the same time. If SQLite misbehaves, point `DATABASE_URL` outside
> the synced folder.

## Checks

```bash
npm run typecheck
npm run lint
npm test                 # integration tests on SQLite (temp-dir database)
npm run build
npm run audit:gate       # production-dependency audit against audit-allowlist.json
```

Run the same test suite against PostgreSQL (the database name must end in `_test` or `_verify`,
because the suite clears its database):

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bureauos_test" npm test
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, the SQLite suite, and a build. It also
applies the PostgreSQL migrations to a Postgres 16 service with a drift check, runs the full suite
there, and runs the dependency gate.

## Database

`prisma/schema.prisma` is the single source of truth. `prisma/postgres/schema.prisma` is
**generated** from it (`npm run db:sync`) for production. Each engine has its own migration
history, and `scripts/prisma-env.mjs` picks the engine from `DATABASE_URL`.

| Command | What it does |
|---|---|
| `npm run db:migration:new -- <name>` | Write a migration for **both** engines from the current schema (no database touched) |
| `npm run db:migrate` | Apply committed migrations to whatever `DATABASE_URL` points at |
| `npm run db:generate` | Generate the Prisma client for that engine |
| `npm run db:sync -- --check` | Fail if the Postgres schema is stale |
| `npm run retention [-- --dry-run]` | Retention sweep (old email logs, unpaid checkout attempts, old Stripe ledger rows) |
| `npm run admin:provision -- --email … --name …` | Create or update a staff account and enroll MFA |

## Customer journey

1. `/` → `/signup` → `/cases/new?navigator=job-separation`
2. Intake (saves as you go), then accept the terms for the case
3. Action plan, plus deadlines: calculated for Florida from the notice dates you enter, otherwise
   NEEDS VERIFICATION
4. Letters tab → Case Pass offer → `/checkout` → Stripe → `/checkout/return`, which waits for the
   webhook
5. Generate, edit, copy, and save letters; deadline reminder emails at 7, 3, and 1 days before,
   and on the day
6. `/billing` (purchases), `/support` (tickets, including refund requests), and `/settings`
   (profile, password, data export, account deletion)

Staff (`/admin`, MFA required in production) see all cases, assign them, add internal notes, answer
tickets, and grant or remove a Case Pass. Grants and removals require a reason and are written to
the audit log.

## Architecture

```
app/                       Pages (public, auth, (app)/ signed-in area, admin/) and api/ route handlers
  api/checkout, stripe/webhook, cases/[id]/letters/render, me/{export,password,mfa}, internal/notifications
lib/
  navigators/              Six navigator content modules (questions, plans; letter METADATA only)
  deadline-rules.ts        Source-checked deadline rules (citations, checked-on dates)
  plan-engine.ts, dates.ts Plan generation; timezone-safe date-only arithmetic
  launch.ts                What is sold, and what each tier includes or excludes (client-safe)
  store.ts                 Client cache over the API; authorization lives on the server
  server/                  Server only: auth, payments, stripe, letters (bodies), notify,
                           reminders, password-reset, case-actions, serializers, audit, rate-limit
prisma/                    schema.prisma (source), migrations/ (SQLite), postgres/ (generated + migrations)
scripts/                   prisma-env, new-migration, sync-postgres-schema, retention, audit-gate, provision-admin
tests/                     Integration tests against a real database (route handlers called directly)
```

Ownership, roles, entitlements, and prices are decided on the server for every request. The client
store and UI only display what the server allows. `tests/letters.test.ts` keeps the boundary
honest: it fails if a client component imports server code.

## Configuration and launch status

Every environment variable is documented in `.env.example`. Launch status, external blockers, the
deployment runbook (Stripe webhook setup, scheduler, backups and restore drill), and the security
ledger are in **`docs/production_readiness.md`**.
