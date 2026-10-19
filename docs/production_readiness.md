# Building202 — Production Readiness (Job Separation launch)

Updated: 2026-10-18 · Branches `launch/job-separation-pilot`, `brand/building202`

**Status: NOT cleared for real paying customers.** The engineering work in this
repository is complete and verified. Launch is blocked on owner-side items that
no code change can supply: a Stripe account and an end-to-end live-mode test,
hosted PostgreSQL with backups, an email provider, production secrets and staff
accounts, attorney review of the deadline rules and legal pages, the
building202.com domain and hosting, and trademark clearance for the Building202
name. Each is listed with its exact action in [Launch blockers](#launch-blockers).

`docs/bureauos_mvp_audit.md` (July 2026) and `docs/backend_migration_plan.md` are
historical. Their findings were revalidated against current code, and this
document supersedes them.

## What is being launched

- **Product:** the Job Separation Navigator. The guided intake, plan, deadline
  tracking, checklists, timeline, support, and deadline reminder emails are free.
  The **Case Pass** (one-time, per case, default $29 via
  `BUREAUOS_CASE_PASS_PRICE_CENTS`) unlocks the letter generator for that case.
- **Deadline scope:** source-checked rules for a Florida pilot.
  - Florida Reemployment Assistance appeal: 20 calendar days after the
    determination's distributed date. A last day on a Saturday, Sunday, Florida
    state holiday (Fla. Stat. § 110.117) or federal holiday when the Postal
    Service is closed moves to the next business day (FloridaCommerce "File an
    Appeal"; Fla. Admin. Code R. 73B-20.005(1); Fla. Stat. § 443.151).
    Unscheduled closures and emergency tolling orders, which the rule also
    counts, can't be known in advance; the caveat says so.
  - Federal COBRA election: the minimum period, 60 days after the later of
    coverage loss and the date the election notice was *provided* (not the
    date printed on it), 26 C.F.R. § 54.4980B-6 Q&A-1. **Both** dates are
    required, or the deadline shows NEEDS VERIFICATION. Not moved off weekends.
  - Marketplace special enrollment: 60 days after coverage ends.

  Everything else is NEEDS VERIFICATION, never estimated. The Florida appeal and
  COBRA rules were re-checked against their sources on 2026-10-18 and the
  Marketplace rule on 2026-10-11. None is **reviewed by an attorney yet**.
- **Not offered:**
  - human review and the human-assisted tiers (off unless
    `BUREAUOS_HUMAN_REVIEW_ENABLED=true`)
  - file uploads (removed)
  - SMS
- **Preview:** the other five navigators stay available as free organizing
  tools, labelled Preview, with nothing for sale.

## Verified on this branch

| Area | Evidence |
|---|---|
| Automated tests | Integration tests pass on **SQLite and on PostgreSQL 16** (`npm test`; `TEST_DATABASE_URL=postgresql://…_test npm test`). Deadline regression suite: `tests/deadline-corrections.test.ts` (weekend and holiday moves, including Oct 5, 2026 → Oct 26, 2026, and COBRA two-date, order, and calendar-boundary cases) |
| Typecheck / lint / build | Clean. The production build has one benign warning: `jose`, inside Auth.js, references `CompressionStream` in Edge middleware for JWE compression that Auth.js doesn't use |
| PostgreSQL migrations | Applied to a real Postgres 16 server; `prisma migrate diff --from-url … --exit-code` reports no drift |
| Production build, run against Postgres (browser + HTTP) | Signup → Job Separation case → branching intake → terms acceptance → plan with Florida appeal **Nov 2, 2026** (Oct 13 + 20) and Marketplace **Dec 30, 2026** (Oct 31 + 60). COBRA shows NEEDS VERIFICATION. Letters locked behind the Case Pass. Data export. Account deletion |
| Production fail-closed (HTTP) | Demo login, dev reset, and payment simulation return 404. Checkout and Stripe webhook return 503 without Stripe. Scheduled runner returns 503 without `CRON_SECRET`. Password reset says it is unavailable without email. Uploads 410, human review 409. Cross-origin mutation 403. No demo/dev UI in production HTML |
| Server-side entitlement (signed-in browser session) | Render or save a letter without a Case Pass: 402. Self-grant or tier change: 403. Paid letter text is absent from the client bundle (`tests/letters.test.ts`, plus a bundle grep) |
| Webhook over real HTTP (staging profile, local test secrets) | Forged signature: 400. Wrong amount: not fulfilled. Genuine event: paid → Case Pass active → letter rendered and saved. Replay: "duplicate". Full refund: Case Pass revoked, saved letter kept. Late replay after refund: not re-granted. **Stripe's side was simulated with locally signed events. No real Stripe account was involved** |
| Staff | Account provisioned with `npm run admin:provision` (TOTP). Production sign-in refused without the code and accepted with it. Case Pass grant needs a reason and is audited. Staff can't self-delete |
| Security headers | CSP (no third-party origins, `frame-ancestors 'none'`), nosniff, DENY framing, referrer and permissions policies; HSTS when served over https |

## Launch blockers

These need the owner. Each is genuinely external to the code.

| # | Blocker | What to do | How to confirm |
|---|---|---|---|
| 1 | **Stripe account + live verification** | Create the account; create a restricted key with Checkout Sessions write. Set the account's public business name and statement descriptor to Building202. Add a webhook endpoint `https://building202.com/api/stripe/webhook` (once the domain is live) with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | On staging (`BUREAUOS_STRIPE_ALLOW_TEST_MODE=true`, test keys): buy with card 4242…, see `/checkout/return` confirm, letters unlock, a refund in the Dashboard re-locks. Then one real low-value live purchase and refund |
| 2 | **Hosted PostgreSQL** | Managed Postgres with TLS, encryption at rest, and point-in-time recovery. Set `DATABASE_URL=postgresql://…?sslmode=require`; deploy runs `npm run build` (generates the Postgres client), then `npm run db:migrate` | `/api/health` → `database: connected`; a restore drill (below) completed once |
| 3 | **Email (Resend)** | Verify building202.com in Resend (SPF/DKIM records), choose a sender address on it, set `RESEND_API_KEY` and `EMAIL_FROM="Building202 <that address>"`. No sender address exists yet | Welcome email arrives; `/forgot-password` sends a working link; Settings → Notifications shows "Emailed" |
| 4 | **Scheduler** | Call `GET /api/internal/notifications` every 15 minutes with `Authorization: Bearer $CRON_SECRET` (≥16 random chars) | Response `ok: true`; a deadline 3 days out produces a reminder |
| 5 | **Production configuration** | `AUTH_SECRET` (`openssl rand -hex 32`), `BUREAUOS_APP_URL=https://building202.com` and `AUTH_URL=https://building202.com` (also at **build** time — it enables HSTS), `BUREAUOS_TRUSTED_PROXY_HOPS` for the host, `UPSTASH_REDIS_REST_URL/TOKEN` for shared rate limits on serverless/multi-instance hosting | Sign-in works over https; cross-origin POSTs get 403 |
| 6 | **Staff accounts** | `DATABASE_URL=<prod> npm run admin:provision -- --email … --name …` per operator; enroll TOTP immediately | Staff sign-in requires the code |
| 7 | **Attorney review** | Review the three deadline rules (`lib/deadline-rules.ts`, `lib/jurisdictions.ts`), including the Florida holiday calendar (`lib/holidays.ts`) and the COBRA "date provided" question wording, the letter templates (`lib/server/letters.ts`), and the Terms / Privacy / Disclaimer drafts. Decide: business entity and contact address, Case Pass refund window, governing law and dispute resolution, named hosting/DB providers, payment-record retention period | Remove the "Draft — pending attorney review" notices (`components/legal-draft-notice.tsx`); bump `DISCLAIMER_VERSION` |
| 8 | **Domain and hosting** | Register building202.com, point DNS at the host, issue TLS, and redirect `www.` to the bare domain (the origin check accepts exactly one origin). Not yet done — nothing in the code assumes it is | `https://building202.com/api/health` returns `ok`; `/robots.txt` and page canonical tags show building202.com |
| 9 | **Trademark clearance** | Clear "Building202" for use in this market (search and, if wanted, registration) before public launch. No search or registration has been done | Counsel's written clearance |

## Remaining issues (not blocking a controlled pilot, but tracked)

- **No email verification at signup.** A mistyped address means no receipts or
  reset links. Add a verify-email step once Resend is live.
- **CSP allows `'unsafe-inline'` scripts and styles,** which Next's App Router
  hydration needs. Nothing can load from another origin; a per-request nonce
  would remove the allowance at the cost of making every page dynamic.
- **Dependency advisories:** five, in `next`'s bundled PostCSS and the Prisma
  CLI's `deepmerge-ts`. None is reachable from user input. They are tolerated in
  `audit-allowlist.json` until 2027-01-31; the fix is Next 16 and Prisma 7 (major
  upgrades). Across all dependencies (dev tooling included) `npm audit` reports
  14; the other 9 are in build and lint tooling only (eslint-config-next, Tailwind
  v3's PostCSS chain, glob utilities) and never ship to the server or browser.
- **Reminder timing uses UTC days,** so near midnight a reminder can say
  "tomorrow" a few hours early or late for US time zones. The email names the
  calendar date.
- **Florida only.** Other states get the tools with NEEDS VERIFICATION
  deadlines. Adding a state means a source-checked rule plus attorney review.
- **Observability:** errors go to `console.error` with ids only. Connect the
  host's log drain or an error tracker before launch.
- **Legacy data:** the `UploadedFile` table is frozen (no writes). Existing
  metadata rows stay exportable and deletable.

## Operations runbook

**Deploy:** set the variables from `.env.example`. Then `npm ci`, `npm run build`
(Postgres client and Next build), `npm run db:migrate`, `npm start`. CI
(`.github/workflows/ci.yml`) must be green: SQLite suite, Postgres suite with
drift check, build, and the dependency gate.

**Schema changes:** edit `prisma/schema.prisma`, then
`npm run db:migration:new -- <name>`, which writes migrations for both engines.
Commit both; CI applies the Postgres one to a real server.

**Backups and restore drill** (do once before launch, then quarterly):
1. Enable the provider's point-in-time recovery, plus a nightly logical backup:
   `pg_dump --format=custom --no-owner "$DATABASE_URL" > building202-$(date +%F).dump`,
   stored encrypted, off the database host.
2. Restore into a scratch database:
   `createdb building202_restore_verify && pg_restore --no-owner -d building202_restore_verify building202-<date>.dump`.
3. Check schema integrity:
   `npx prisma migrate diff --from-url postgresql://…/building202_restore_verify --to-schema-datamodel prisma/postgres/schema.prisma --exit-code`.
4. Point a staging instance at it and check `/api/health`, a sign-in, and a case
   page. Record the date and the restore time. Drop the scratch database.

**Data lifecycle:** run `npm run retention` daily (`-- --dry-run` to preview).
Customers delete their own data via Settings. Purchase rows are kept with the
person unlinked.

**Refunds:** issue them in the Stripe Dashboard; the webhook removes the Case
Pass automatically. A staff goodwill grant uses the admin case page (reason
required, audited).

**Incident: payment taken but no Case Pass.** Check `Purchase.status` for the
session id, then the Stripe Dashboard's event delivery for
`checkout.session.completed`. Redelivering from Stripe is safe (idempotent). If
the amount didn't match, fulfilment is refused by design and logged: refund, or
grant manually with a reason.

## Brand and legacy identifiers

The product was renamed from BureauOS to Building202 (branch `brand/building202`). Every
customer-facing surface says Building202. The terms acceptance version moved to
`2026-10-18.v3`, so acceptance records stay tied to the text accepted: v2 rows were accepted under
the BureauOS name. These internal identifiers keep the old spelling **on purpose**:

| Identifier | Where | Why it stays |
|---|---|---|
| `BUREAUOS_*` environment variables (`APP_URL`, `TRUSTED_PROXY_HOPS`, `REQUIRE_STAFF_MFA`, `STRIPE_ALLOW_TEST_MODE`, `CASE_PASS_PRICE_CENTS`, `HUMAN_REVIEW_ENABLED`, `RETAIN_*`) | `.env.example`, `lib/server/*`, `next.config.mjs` | Renaming silently unsets every deployment's configuration |
| `bureauos-checkout-<purchase>` | Stripe Checkout idempotency key (`lib/server/payments.ts`) | A retry spanning a deploy must send the same key, or Stripe creates a second session |
| `bureauos-notification-<id>` | Resend idempotency key (`lib/server/notify.ts`) | Same: a retried email must not be delivered twice |
| `bureauos:rl:` | Upstash rate-limit key prefix | Renaming resets every live rate-limit window |
| `[bureauos]` | Server log tag | Log searches and alerts match on it; not shown to customers |
| `"service": "bureauos"` | `/api/health` response | Uptime monitors may match on it; machine-facing |
| `demo@bureauos.app`, `admin@bureauos.app`, password `bureau-demo` | Development demo accounts (`lib/constants.ts`) | Tests and existing development databases use them; refused at sign-in in production |
| `useBureauStore`, `BureauState` | Client store (`lib/store.ts`) | Internal API used across the UI |
| `bureauos` | npm package name (`package.json`, `package-lock.json`), GitHub repository, `.claude/launch.json` | Not customer-facing; matches the repository |
| `bureauos_test`, `bureauos-test`, `bureauos-migration-` | CI test database, temp directories | Tooling only |

`docs/bureauos_mvp_audit.md` and `docs/backend_migration_plan.md` keep the old name as historical
records.

## Security ledger

| Control | State |
|---|---|
| Authorization | Ownership and role are re-checked on the server for every request. A customer can't reach another's data (404), staff-only fields are stripped, and paid features are entitlement-checked on the server |
| Sessions | Auth.js JWT, 7 days. Rejected after a password change or reset (`sessionVersion`) or account deletion |
| Staff | TOTP MFA required in production; audited actions (status, assignment, notes, Case Pass grant and removal, case deletion) |
| Abuse | Per-IP limits (auth 20/min, mutations 120/min). Per-account sign-in (10 per 15 min), re-authentication (8 per 15 min), reset emails (3 per hour), exports (5 per 10 min). Shared across instances only with Upstash configured |
| CSRF | Auth.js tokens on its endpoints; same-origin check (pinned to `BUREAUOS_APP_URL`) on every other mutation |
| Payments | Server-created Checkout; signature-verified, idempotent webhook (ledger row in the same transaction); amount, currency, and session checked; refunds and disputes revoke; test keys refused in production |
| Secrets | Server-only modules never imported by client code (enforced by test). Paid letter text is server-only. No secrets in the bundle |
| Privacy | Export (JSON), self-service account deletion, retention sweep. Reset tokens stored only as hashes, and their email bodies cleared after send. No uploads, no third-party scripts |
| Dev surfaces | Demo accounts refused at sign-in in production; demo/reset/simulate routes return 404 in production; seed and wipe refuse in production |
