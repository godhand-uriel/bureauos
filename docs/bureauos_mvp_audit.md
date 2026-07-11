# BureauOS MVP Audit

Date: 2026-07-08  
Auditor: Codex acting as QA engineer, product engineer, security reviewer, and startup CTO

## Executive Summary

BureauOS is safe for a controlled internal or stakeholder demo as a clearly labeled local-demo MVP. The build is healthy, all major requested routes load, customer and admin flows work, the UI is generally honest about mocked systems, and the codebase is not polluted with unrelated product content.

It is not production-ready and must not be used with real customer PII, real payments, real legal reliance, or real file storage. The MVP remains localStorage-based, client-gated, and demo-authenticated by design.

Two obvious data-integrity issues were fixed during audit:

- Case-gated legal acknowledgements now require acceptance for the specific case instead of relying on any global acceptance.
- Support tickets now sanitize the related case ID so a customer cannot create a ticket attached to another user's case via a crafted URL/query value.

## What Works

- Next.js production build completes successfully.
- Lint passes with no warnings or errors.
- Public routes, customer app routes, admin routes, dynamic case routes, dynamic support routes, and `/api/health` are reachable.
- Demo customer can create a case, complete intake, accept terms/privacy/disclaimer, generate a plan, update document checklist metadata, save a letter, open a support ticket, upgrade through simulated checkout, request review, and return to dashboard with progress saved.
- Demo admin can view all cases, open case detail, change status, add internal notes, verify uploaded-file metadata, manage review status, view support tickets, reply as staff, and customer accounts are blocked from admin pages.
- Fresh signup sees no demo customer or audit-created cases.
- Demo customer sees only that customer's cases.
- Admin can see all cases.
- Billing, notifications, file handling, review, and checkout are consistently presented as local-demo, simulated, metadata-only, mocked, or future-integration workflows.
- BureauOS product surface is separate from forbidden adjacent products/categories.

## What Was Tested

### Build Health Commands

- `npm install`
- `npm run lint`
- `npm run build`
- Typecheck script: not present in `package.json`; Next build still ran type validity checks.

Notes:

- `npm install` reported 2 moderate npm audit vulnerabilities. I did not run `npm audit fix --force` because that can introduce breaking dependency changes outside the audit scope.
- `next lint` is deprecated in Next 15/16 path, but it passed.

### Route Audit

Static and major routes tested in the browser unless noted:

- `/`
- `/login`
- `/signup`
- `/dashboard`
- `/navigators`
- `/pricing`
- `/checkout`
- `/billing`
- `/support`
- `/support/new`
- `/assistant`
- `/settings`
- `/settings/notifications`
- `/legal/terms`
- `/legal/privacy`
- `/legal/disclaimer`
- `/admin`
- `/admin/reviews`
- `/admin/support`
- `/api/health`

`/api/health` was verified by local HTTP request and returned HTTP 200:

```json
{"status":"ok","service":"bureauos","mode":"local-demo"}
```

The in-app browser blocked direct navigation to `/api/health` with `ERR_BLOCKED_BY_CLIENT`, so the shell HTTP check is the authoritative route verification for that endpoint.

Dynamic routes tested with real seeded/demo IDs:

- Seeded case: `bcebe98f-df13-4f08-baf0-9f77be33bb0b` (`MRI claim denial - Meridian Health`)
- Seeded support ticket: `88f8a54b-90a7-45e9-8304-29016e3643aa`

Routes tested:

- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b`
- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b/intake`
- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b/plan`
- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b/documents`
- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b/letters`
- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b/timeline`
- `/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b/review`
- `/support/88f8a54b-90a7-45e9-8304-29016e3643aa`
- `/admin/cases/bcebe98f-df13-4f08-baf0-9f77be33bb0b`
- `/admin/support/88f8a54b-90a7-45e9-8304-29016e3643aa`

Audit-created flow IDs:

- Audit case: `4898f4aa-25c6-4a9d-8ca0-40364c616090` (`QA audit DMV case`)
- Audit support ticket: `bdb29544-e6f7-42c7-8f01-59e5306afd75`

## Customer Flow Result

Passed with one automation limitation noted under Remaining UX Issues.

Tested:

1. Logged in as demo customer.
2. Created `QA audit DMV case`.
3. Chose the DMV navigator.
4. Completed intake with required and conditional answers.
5. Accepted Terms of Service, Privacy Policy, and Legal Disclaimer for the case.
6. Generated the DMV action plan.
7. Updated document checklist metadata by marking `DMV notice or correspondence` as obtained.
8. Generated and saved a DMV records request letter.
9. Opened a support ticket tied to the case.
10. Upgraded the case/customer to Priority Case Support through simulated checkout.
11. Requested professional review.
12. Returned to dashboard.
13. Confirmed the case remained visible and progress persisted.

## Admin Flow Result

Passed.

Tested:

1. Logged in as demo admin.
2. Visited `/admin`.
3. Viewed all customer cases.
4. Opened the audit-created case detail page.
5. Changed case status to `waiting`.
6. Added an internal note.
7. Verified seeded uploaded-file metadata by setting `meridian-denial-letter.pdf` to `verified`.
8. Viewed review requests.
9. Advanced the newest review request to `in_review` and added a reviewer note.
10. Viewed support ticket queue.
11. Replied to the audit-created support ticket as staff.
12. Logged back in as demo customer and confirmed `/admin` shows the staff-area block instead of admin content.

## Data Integrity Audit

What passed:

- Fresh signup saw no demo customer cases.
- Demo customer saw demo/audit customer data only.
- Admin saw all cases.
- Support ticket created in the customer flow was tied to the audit case.
- Review request created in the customer flow was tied to the audit case.
- Case-scoped disclaimer acceptance was required and recorded during intake after the fix.
- Billing/subscription state updated to Priority Case Support via simulated checkout.
- Notifications appeared in the mock outbox for billing, review, and staff support reply.
- v1 to v2 migration path was source-reviewed: legacy data is parsed through Zod, mapped to the demo customer, and guarded against unreadable/corrupt data. Full automated migration mutation was not performed because the browser automation surface does not expose writable localStorage in this environment.

## Product Truthfulness Audit

Passed with minor copy watch-outs.

The UI does not claim:

- BureauOS is a law firm.
- BureauOS provides legal advice.
- Attorney review is live.
- Payments are real.
- SMS/email notifications are actually sent.
- File bytes are uploaded to a server.
- Jurisdiction rules are complete or guaranteed.

Mocked systems are generally labeled:

- Checkout: simulated, no real charge.
- Billing: simulated entries.
- Notifications: mock outbox, not sent.
- Files: metadata-only/local, bytes stay on device.
- Assistant: local rules, provider interface for future model integration.
- Legal documents: demo placeholders.
- Health endpoint: `mode: local-demo`.

Copy watch-outs:

- Some labels say "Uploaded files" and "Attach files"; nearby callouts make clear this is metadata-only in the local MVP. Keep that callout visible.
- Seeded review copy can feel live because it uses realistic staff/reviewer wording. It is acceptable for demo data, but should stay framed as demo/local state in any presentation.

## BureauOS Purity Search

Requested command attempted:

```bash
grep -Rni "parlay\|betting\|sports\|trustbase\|govshield\|hipaa\|fedramp\|vendorrisk\|medwaste\|ai governance\|holding company\|acquisition" .
```

Result: `grep` is not installed in this PowerShell environment.

Equivalent search run:

```bash
rg -n -i "parlay|betting|sports|trustbase|govshield|hipaa|fedramp|vendorrisk|medwaste|ai governance|holding company|acquisition" .
```

Result before report creation: no matches.

These terms are listed here only as forbidden audit search terms. Product/app content remained clean.

## Bugs Found

1. Case-specific disclaimer acceptance was bypassed for demo customer

- Symptom: `useHasAccepted()` returned true for any current-version acceptance, including seeded global acceptance with `caseId: null`.
- Impact: New demo customer cases could skip per-case terms/privacy/disclaimer acceptance, so acceptance was not reliably recorded with user, case, version, and timestamp.
- Status: fixed.

2. Support ticket case association trusted the incoming case ID

- Symptom: `createTicket` accepted any `caseId` passed by the caller.
- Impact: A crafted `/support/new?case=<other-case-id>` could create a ticket belonging to the current user but attached to another user's case ID in local state.
- Status: fixed.

3. Native file-picker metadata path was not fully automatable in this audit environment

- Symptom: Browser automation surface does not expose file selection, and Computer Use safety rules prohibit automating the Codex app UI that hosts the in-app browser.
- Impact: File status/document metadata was tested, and seeded uploaded-file admin review was tested, but adding a brand-new uploaded-file metadata row through the native file picker was not completed.
- Status: documented as a test limitation/UX issue, not an app code bug.

4. npm audit reported 2 moderate vulnerabilities

- Symptom: `npm install` completed but reported two moderate audit findings.
- Impact: Unknown without `npm audit` detail review. Not a current demo blocker, but a productionization item.
- Status: documented, not auto-fixed.

## Bugs Fixed

Files changed:

- `components/disclaimer-gate.tsx`
- `app/(app)/cases/[id]/intake/page.tsx`
- `lib/store.ts`

Fixes:

- `DisclaimerGate` now checks acceptance for the specific `caseId`.
- Intake completion now checks case-specific acceptance before generating a plan.
- `useHasAccepted(caseId)` supports case-aware acceptance checks.
- `createTicket` now resolves the related case only when the current user owns it or is admin; otherwise the ticket is created with `caseId: null`.

## Remaining UX Issues

- The hidden native file input is awkward for automated QA and not easily testable without full browser/file-picker tooling.
- "Uploaded files" wording is acceptable because of adjacent metadata-only copy, but "Tracked file metadata" would be even clearer in a later polish pass.
- Admin file verification works for uploaded-file metadata, but admin does not have a full document-checklist verification workflow separate from uploaded files.
- Signup seeds demo data globally in localStorage for demo availability, then scopes visible dashboard data by user. This works, but the architecture can be confusing during QA because localStorage contains multiple users' demo data.
- Admins can technically view `/support/[id]` because the customer ticket page permits admin viewing; staff replies are correctly handled in `/admin/support/[id]`, so this should be tightened or redirected later.

## Remaining Security Risks

Demo-only risks that must not be mistaken for production security:

- Data is stored in localStorage.
- Access control is client-side.
- Demo auth uses a non-cryptographic local hash and fixed demo credentials.
- There is no server-side RBAC.
- There is no real database or server-side owner scoping.
- There is no secure file storage.
- There is no webhook validation.
- There are no immutable audit logs.
- There is no rate limiting.
- There are no real PII protections.
- Notifications are local mock records, not delivery events.
- Payment state is locally simulated and not backed by Stripe.
- Case/review/support operations are local client actions.

## Mocked vs Real Systems

| Area | MVP behavior | Production requirement |
| --- | --- | --- |
| Auth | Demo local users and local session | Clerk, Supabase Auth, Auth.js, or equivalent |
| Authorization | Client-side route/component gates | Server-side RBAC and owner checks |
| Data storage | localStorage via Zustand persist | Postgres/Supabase/Prisma with migrations |
| Payments | Simulated checkout and mock billing entries | Stripe Checkout, products/prices, signature-verified webhooks |
| Files | Metadata only, file bytes stay local | Presigned encrypted object storage plus malware scanning |
| Notifications | Mock outbox records | Resend/SendGrid/SES/Twilio delivery adapters |
| Assistant | Local rule routing | Real provider integration with safe prompts, logging, and limits |
| Reviews | Local workflow and seeded demo staff notes | Real operations queue, assignments, audit trail, SLAs |
| Legal docs | Demo placeholders | Counsel-reviewed terms, privacy policy, disclaimer |
| API | Health endpoint only | Authenticated API layer for cases/files/tickets/reviews/billing |

## Production Blockers

- Replace demo auth with real authentication.
- Enforce server-side authorization/RBAC and row-level data ownership.
- Move from localStorage to a real database.
- Add secure, encrypted file storage and upload validation.
- Add Stripe checkout and webhook signature validation.
- Add real notification providers with unsubscribe/compliance handling.
- Add audit logs for case/admin/review/support actions.
- Add rate limiting and abuse controls.
- Add production-grade PII handling, retention, deletion, and export controls.
- Finalize legal terms, privacy policy, and disclaimers with counsel.
- Resolve npm audit findings or document accepted risk.

## P0 Fixes Required Before Showing Users

For controlled internal demo/stakeholder review:

- No P0 app-breaking issues remain after the fixes above.
- Demo must be presented as local-only and must not use real customer PII or real documents.
- Keep simulated payment, notification, file, and review labels visible during the demo.

Before any external/non-demo user use:

- Server-side auth and RBAC.
- Real database with owner scoping.
- Secure file storage or remove file attachment UI.
- Real legal docs reviewed by counsel.
- Remove demo password/hash model.
- Add audit logs for admin/review/support actions.

## P1 Productionization Steps

- Implement API routes for cases, tickets, reviews, files, billing, and notifications.
- Add Prisma/Postgres migrations and seed scripts.
- Add integration tests for user scoping and admin RBAC.
- Add Playwright tests for route coverage and customer/admin happy paths.
- Add Stripe products, checkout, customer portal, and signed webhooks.
- Add secure upload flow with presigned URLs, content validation, and malware scanning.
- Add operational review queue permissions, assignments, and internal audit trail.
- Replace `next lint` script before Next 16 migration.
- Review and remediate npm audit findings.

## P2 Future Feature Improvements

- Better document-checklist/admin verification workflow.
- First-class import/export/delete controls for user data.
- Stronger demo reset and fixture controls for QA.
- More granular notification event preferences.
- Jurisdiction data versioning with source citations.
- Optional guided walkthrough for first-time demo users.
- Real file attachment previews once secure storage exists.
- Better redirect behavior when admins land on customer-only support routes.

