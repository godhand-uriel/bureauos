# BureauOS Backend Migration — Phases 1–2 (completed) and beyond

Date: 2026-07-09 (Phase 1) · 2026-07-11 (Phase 2)
Status: **Phase 1 + Phase 2 implemented** — Prisma/SQLite is the source of
truth behind validated API routes with server-side ownership checks (Phase 1),
and authentication now runs on Auth.js with middleware-enforced sessions,
CSRF hardening, and rate limiting (Phase 2). This document records what moved,
how the architecture works, and what the next phases are.

## Phase 2 — real authentication (completed 2026-07-11)

Replaced the hand-rolled Session table + cookie with **Auth.js (NextAuth v5)**:

- **Credentials provider** over the existing Prisma User table (scrypt hashes
  in `lib/server/passwords.ts` remain as the credentials backend). Runs fully
  locally — no external identity service needed. `auth.ts` / `auth.config.ts`
  hold the config (edge-safe split so the middleware never imports Prisma).
- **Stateless JWT sessions**: signed+encrypted httpOnly SameSite=Lax cookies
  (`AUTH_SECRET`). The `Session` model was dropped
  (migration `drop_custom_sessions`).
- **Middleware enforcement** (`middleware.ts`): unauthenticated requests get
  401 JSON on protected APIs and a `/login` redirect on protected pages;
  `/admin` additionally requires the admin role from the token. Route handlers
  still re-resolve the user from the database on every request
  (`lib/server/auth.ts`), so role/ownership never rely on a stale token —
  deleting a user revokes access immediately despite the stateless JWT.
- **CSRF**: Auth.js's own endpoints carry CSRF tokens; all other mutating API
  requests must pass a same-origin check in the middleware, on top of the
  SameSite=Lax cookie.
- **Rate limiting** (`lib/server/rate-limit.ts`): in-memory sliding window per
  IP — 20/min on auth endpoints, 120/min on other mutations. Per-instance
  only; swap for Upstash/Redis behind the same signature in production.
- **Route changes**: `/api/auth/[...nextauth]` added (signin/signout/session/
  csrf); `/api/auth/login` and `/api/auth/logout` deleted; `/api/auth/signup`
  now only creates the account (client signs in through Auth.js after);
  `/api/auth/demo` only ensures the demo seed exists.
- Verified in the browser: login/logout/demo/signup flows, middleware
  redirects and 401s, role-gated `/admin`, RBAC probes still 403, 429 after
  the auth rate budget, 403 on cross-origin mutations, reset/reseed.

## Why

The MVP audit (`docs/bureauos_mvp_audit.md`) found the app demo-safe but not
production-viable: all data lived in localStorage and every access-control
check ran in the browser. Phase 1 moves persistence and authorization
server-side without changing the UI or product surface.

## Architecture after Phase 1

```
Browser (React components — unchanged)
   │  same store actions/selectors as before
   ▼
lib/store.ts (v3) — in-memory session cache
   │  GET /api/bootstrap on load; optimistic writes with
   │  server response reconciliation (per-entity sequence guard)
   ▼
app/api/* — Zod-validated route handlers
   │  every route: session lookup → ownership/role check → mutation
   ▼
lib/server/* — auth, serializers, case-action service, notify, seed
   ▼
Prisma → SQLite (prisma/dev.db)   [Postgres-ready]
```

Key properties:

- **Server is authoritative.** Case/ticket/review/billing/acceptance state is
  read from and written to the database. The client cache is convenience, not
  truth: a page reload re-derives everything from `/api/bootstrap`.
- **Authorization is server-side.** Session comes from an httpOnly cookie →
  `Session` table → user + role. Customers are owner-scoped on every read and
  write; admin-only mutations (assign, internal notes, review/ticket
  management, file verification) check the role from the session, never from
  client input. Inaccessible case ids return 404 (not 403) to prevent probing.
- **Sanitized responses.** `passwordHash` never serializes. Case `adminNotes`
  and ticket `internalNotes` are stripped from customer responses.
- **Audit fixes now enforced server-side:**
  - per-case disclaimer acceptance is required by the server before
    `complete_intake`, `save_letter`, and review requests;
  - ticket `caseId` is resolved server-side and dropped to `null` unless the
    requester owns (or administers) the referenced case.
- **The rule engine runs on the server** for `complete_intake` /
  `regenerate_plan`, so plans/tasks/deadlines are server-derived and no longer
  ship engine+content code in the client bundle for that purpose.

### Write model (optimistic + reconcile)

Most mutations apply to the client cache immediately (identical logic to the
old local store) and POST to the API; the server response — the authoritative,
authorization-checked entity — replaces the optimistic copy when it lands. A
per-entity sequence counter discards stale responses from rapid successive
writes. Flows that need server output before proceeding are awaited instead:
signup/login, case creation, intake completion (plan generation), ticket
creation, review requests, checkout.

Failure handling in Phase 1 is intentionally simple: failed write-throughs log
a console warning and the optimistic state stands until the next reload. See
Known gaps.

## Schema deltas (SQLite adaptation)

`prisma/schema.prisma` is the original Postgres-shaped draft adapted to run on
SQLite today:

| Original draft | Phase 1 schema | Reason |
|---|---|---|
| Prisma `enum`s (status, role, tier…) | `String` columns holding the domain's lowercase values | SQLite has no enums; Zod validates at the API boundary |
| `Json` columns (answers, plan actions/flags) | `String` columns with serialized JSON | Portable on SQLite; serializers parse |
| — | `Session` model | demo-grade cookie sessions |
| `authProviderId` | `passwordHash` (scrypt) | demo-grade credentials until a real provider lands |
| `UploadedFile.sizeBytes`, `storageKey` | `sizeLabel` (+ `storageKey` kept, default `""`) | bytes are not stored in Phase 1 |
| `Payment.amountCents` | `label`/`amountLabel`/`kind` | simulated billing entries |
| `JurisdictionRule` model | removed for now | jurisdiction samples stay code-defined in `lib/jurisdictions.ts` |

Moving to Postgres: switch the provider, reintroduce enums/Json (mechanical
renames in `lib/server/serializers.ts`), create a fresh migration, and drop
`Session`/`passwordHash` when the real auth provider replaces demo sessions.

## What moved to the database (Phase 1)

Users (+notification preferences), sessions, cases, intake answers, action
plans, tasks, document requirements, deadlines, generated letters, timeline
events, admin notes (case/ticket/review), support tickets + messages, review
requests, uploaded-file metadata, subscriptions + simulated billing history,
disclaimer acceptances, notification events.

## What did NOT move (unchanged by design)

- Navigator content, intake questions, rule logic, letter templates,
  jurisdiction samples, service-tier definitions — code-defined content.
- The assistant — rule-based, client-side.
- localStorage: no longer holds any case/support/review/billing/acceptance
  data. (Remaining browser state is React component state only, e.g. the
  in-progress intake draft before each step saves.)

## Known gaps (accepted for Phase 1)

- Failed write-throughs warn on the console instead of rolling back or
  retrying; refresh restores server truth.
- Rapid repeated intake saves are last-write-wins without a version check.
- Rate limiting is per-process (in-memory); multi-instance deploys need a
  shared store.
- Demo accounts use a published shared password by design; remove them before
  any external exposure.
- No pagination — bootstrap returns full scoped datasets (fine locally).
- `/api/dev/reset` wipes the whole database; it is blocked in production
  builds but is a demo tool, not an admin feature.

## Next phases

1. ~~**Phase 2 — real auth**~~ **Done** — Auth.js credentials + JWT sessions,
   middleware enforcement, CSRF origin checks, rate limiting (see above).
2. **Phase 3 — Postgres + operations**: provider switch, audit-log table for
   staff actions, integration tests for ownership/RBAC (the API surface is now
   testable without a browser), background job for notification delivery.
3. **Phase 4 — Stripe + storage**: real checkout/webhooks replacing
   `/api/billing`; presigned uploads replacing metadata-only files.
