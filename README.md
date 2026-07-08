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
npm install
npm run dev      # http://localhost:3000
```

Checks and production build:

```bash
npm run lint
npm run build
npm start
```

**No environment variables are required.** The app runs fully offline in demo mode.

> Tip: if the project lives in a OneDrive-synced folder, OneDrive can occasionally lock files in
> `.next` and fail a build with a spurious `PageNotFoundError`. Delete `.next` and rebuild, don't
> run `next dev` and `next build` at the same time, or move the project outside OneDrive.

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
| Auth | Local demo auth (non-cryptographic hash, browser session) | Clerk / Supabase Auth / Auth.js — swap `signUp/logIn/logOut` + `useCurrentUser` |
| Database | Zod-validated localStorage (zustand) | Prisma + Postgres (Supabase/Neon/RDS) — schema ready in `prisma/schema.prisma` |
| Payments | Simulated checkout, mock billing history, clearly labeled | Stripe Checkout + verified webhooks; tiers map 1:1 to Stripe prices |
| File uploads | Metadata only; bytes never leave the device, labeled in UI | Presigned uploads to S3 / Supabase Storage / R2 / GCS |
| Notifications | Mock outbox (visible in `/settings/notifications`) honoring prefs | Resend/SendGrid/Postmark + Twilio/SNS/SES workers off the same event model |
| AI assistant | Deterministic rule-based provider (no keys needed) | Same `AssistantProvider` interface backed by Anthropic/OpenAI/OpenRouter |
| Jurisdiction rules | Seeded samples (CA, TX, WA, FL, federal) with per-rule disclaimers | Maintained dataset in the `JurisdictionRule` table with editorial review |

The UI never claims a mocked service is live.

## Architecture

```
app/
  page.tsx, pricing/, legal/*          Public pages (marketing shell)
  login/, signup/                      Auth screens (local demo auth)
  api/health/route.ts                  API layer seed + documented route map
  (app)/                               Authenticated app (sidebar shell + auth gate)
    dashboard/, assistant/, navigators/, cases/, support/, billing/,
    checkout/, settings/, settings/notifications/
    admin/                             Staff-only console (role-gated)
components/                            Product components + ui/ primitives
lib/
  types.ts, schemas.ts                 Domain model + Zod validation for all persisted data
  store.ts                             Local-first data layer (user-scoped, v2) — swap point
  plan-engine.ts                       Rule-based action plan engine
  packages.ts                          Service tiers (Stripe-shaped)
  jurisdictions.ts                     Jurisdiction rules framework + samples
  assistant.ts                         AssistantProvider interface + rule-based provider
  navigators/                          Six navigator content modules
  seed.ts                              Demo cases (built via the real plan engine)
prisma/schema.prisma                   Production DB schema (migration target, not wired)
```

**Swap-point discipline.** Components only talk to store actions and selectors. Persistence,
auth, billing, storage, notifications, and the assistant are each behind a small interface with
the production provider documented at the swap point.

## Production upgrade path

1. **Database** — wire Prisma to `prisma/schema.prisma` (SQLite locally, Postgres hosted);
   move store action bodies into API routes; validate inputs with `lib/schemas.ts`.
2. **Auth** — replace demo auth with Clerk/Supabase/Auth.js; enforce sessions in middleware;
   keep the `customer`/`admin` role model.
3. **Payments** — create Stripe products for the four tiers; replace `/checkout` with Stripe
   Checkout; handle `checkout.session.completed` + subscription webhooks (verify signatures).
4. **Storage** — presigned upload endpoint; store object keys (schema already has `storageKey`).
5. **Notifications** — worker that drains `NotificationEvent` rows through Resend/Twilio.
6. **Assistant** — API route implementing `AssistantProvider` with a real model.
7. **Deploy** — Vercel or any Node host; set env vars from `.env.example`; `npm run build`.

## Security notes for production

- **Authentication**: managed provider (Clerk/Supabase/Auth.js); never ship the demo hash. MFA for staff.
- **Authorization / RBAC**: enforce owner-scoping and the customer/admin split server-side on every
  API route (the client-side gates in this MVP are UX, not security).
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

- All data is per-browser localStorage: no sync, no server enforcement, demo-grade auth
- File bytes stay on-device (metadata only)
- Checkout/billing/notifications are simulations, labeled as such in the UI
- Jurisdiction rules are illustrative samples, not a maintained legal dataset
- The assistant is keyword-routing, not a language model
