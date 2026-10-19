/**
 * Data-retention sweep. Run on a schedule (daily is plenty) from the host's
 * cron or scheduler:
 *
 *   npm run retention            apply
 *   npm run retention -- --dry-run   report what would be removed, change nothing
 *
 * What it removes, and why each is safe to remove:
 *   - notification records older than BUREAUOS_RETAIN_NOTIFICATIONS_DAYS (180)
 *     — a delivery log, not the customer's case data
 *   - checkout attempts that were never paid (expired / failed) older than
 *     BUREAUOS_RETAIN_ABANDONED_CHECKOUT_DAYS (30) — no money moved
 *   - Stripe event-ledger rows older than BUREAUOS_RETAIN_STRIPE_EVENT_DAYS
 *     (90) — Stripe stops retrying an event after about three days, so an
 *     entry that old can no longer be replayed
 *
 * What it never touches: accounts, cases and their contents, paid / refunded /
 * disputed purchases (financial records), entitlements, and the staff audit
 * log. Customer data is removed when the customer deletes a case or their
 * account — not by a timer.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

function days(envName: string, fallback: number, minimum: number): number {
  const n = Number(process.env[envName]);
  // A misconfigured value must not turn into "delete almost everything".
  return Number.isFinite(n) && n >= minimum ? Math.floor(n) : fallback;
}

const cutoff = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function main() {
  const notificationDays = days("BUREAUOS_RETAIN_NOTIFICATIONS_DAYS", 180, 30);
  const checkoutDays = days("BUREAUOS_RETAIN_ABANDONED_CHECKOUT_DAYS", 30, 7);
  const stripeEventDays = days("BUREAUOS_RETAIN_STRIPE_EVENT_DAYS", 90, 30);

  const targets = [
    {
      label: `notification records older than ${notificationDays} days`,
      count: () => prisma.notificationEvent.count({ where: { createdAt: { lt: cutoff(notificationDays) } } }),
      remove: () => prisma.notificationEvent.deleteMany({ where: { createdAt: { lt: cutoff(notificationDays) } } }),
    },
    {
      label: `unpaid checkout attempts older than ${checkoutDays} days`,
      count: () =>
        prisma.purchase.count({
          where: { status: { in: ["expired", "failed"] }, stripePaymentIntentId: null, createdAt: { lt: cutoff(checkoutDays) } },
        }),
      remove: () =>
        prisma.purchase.deleteMany({
          where: { status: { in: ["expired", "failed"] }, stripePaymentIntentId: null, createdAt: { lt: cutoff(checkoutDays) } },
        }),
    },
    {
      label: `Stripe event-ledger rows older than ${stripeEventDays} days`,
      count: () => prisma.stripeEvent.count({ where: { processedAt: { lt: cutoff(stripeEventDays) } } }),
      remove: () => prisma.stripeEvent.deleteMany({ where: { processedAt: { lt: cutoff(stripeEventDays) } } }),
    },
  ];

  console.log(dryRun ? "Retention sweep — DRY RUN (nothing will be deleted)" : "Retention sweep");
  for (const target of targets) {
    const count = await target.count();
    if (!dryRun && count > 0) await target.remove();
    console.log(`  ${dryRun ? "would remove" : "removed"} ${count} ${target.label}`);
  }
}

main()
  .catch((err) => {
    console.error("Retention sweep failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
