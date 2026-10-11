#!/usr/bin/env node
/**
 * Create a new SQLite migration from the current schema without the
 * interactive `prisma migrate dev` flow:
 *
 *   npm run db:migration:new -- add_something
 *
 * Diffs prisma/migrations against prisma/schema.prisma using a throwaway
 * shadow database in the OS temp directory (never inside the repo, so file
 * sync tools can't lock it), writes prisma/migrations/<timestamp>_<name>/
 * migration.sql, and prints the SQL. Apply it with `npm run db:migrate`.
 */
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const name = (process.argv[2] ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
if (!name) {
  console.error("Usage: npm run db:migration:new -- <migration_name>");
  process.exit(1);
}

const shadowDir = mkdtempSync(path.join(tmpdir(), "bureauos-shadow-"));
const shadowUrl = `file:${path.join(shadowDir, "shadow.db").replace(/\\/g, "/")}`;

let sql;
try {
  // Single command string: every part is static except the temp-dir shadow
  // URL, which is quoted.
  sql = execSync(
    `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "${shadowUrl}" --script`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (err) {
  console.error(String(err.stderr ?? err.message).slice(0, 2000));
  process.exit(1);
} finally {
  try {
    rmSync(shadowDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

if (!sql.trim() || /empty migration/i.test(sql)) {
  console.log("Schema and migrations are already in sync — nothing to generate.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dir = path.join("prisma", "migrations", `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "migration.sql"), sql, "utf8");
console.log(`Wrote ${path.join(dir, "migration.sql")}:\n`);
console.log(sql);
