import { PrismaClient } from "@prisma/client";
import { createInterface } from "readline/promises";
import { hashPassword } from "../lib/server/passwords";
import { buildOtpauthUrl, generateTotpSecret, totpAt } from "../lib/server/totp";
import { DEFAULT_NOTIFICATION_PREFS } from "../lib/constants";

/**
 * Operator CLI: provision (or re-key) a staff/admin account with a fresh
 * TOTP secret — the production bootstrap path for the staff-MFA sign-in
 * requirement, since production refuses admin sign-in without enrolled MFA.
 *
 *   npm run admin:provision -- --email ops@example.com --name "Ops Name"
 *
 * Prompts for the password (not taken as an argv, so it stays out of shell
 * history), prints the otpauth URI + secret ONCE, and marks MFA enabled.
 * Run against the target database via DATABASE_URL.
 */
async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = get("--email")?.toLowerCase();
  const name = get("--name") ?? "BureauOS Staff";
  if (!email || !email.includes("@")) {
    console.error('Usage: npm run admin:provision -- --email ops@example.com [--name "Ops Name"]');
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question(`Password for ${email} (min 12 chars): `);
  rl.close();
  if (password.length < 12) {
    console.error("Refusing: staff passwords must be at least 12 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const secret = generateTotpSecret();
    const data = {
      name,
      role: "admin",
      passwordHash: hashPassword(password),
      mfaSecret: secret,
      mfaEnabled: true,
    };
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        ...data,
        notificationPrefs: { create: { ...DEFAULT_NOTIFICATION_PREFS } },
      },
      update: data,
    });

    console.log("\nStaff account provisioned with MFA enabled.");
    console.log("Add this to the authenticator app NOW — it is not shown again:\n");
    console.log(`  otpauth URI: ${buildOtpauthUrl(email, secret)}`);
    console.log(`  Secret (manual entry): ${secret}`);
    console.log(`\n  Current code (sanity check): ${totpAt(secret, Date.now() / 1000)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
