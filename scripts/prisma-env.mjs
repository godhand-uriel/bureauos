#!/usr/bin/env node
/**
 * Run a Prisma CLI command against the schema that matches DATABASE_URL:
 *
 *   postgres:// or postgresql://  →  prisma/postgres/schema.prisma  (production)
 *   anything else (file:…)        →  prisma/schema.prisma           (SQLite dev/test)
 *
 *   node scripts/prisma-env.mjs generate
 *   node scripts/prisma-env.mjs migrate deploy
 *
 * Prisma fixes the database provider in the schema file, so the engine is
 * chosen by picking the file — the URL alone decides, never a second flag
 * that could disagree with it. The generated client is engine-specific:
 * `postinstall` and `build` both run `generate` through this script, so a
 * deployment with a Postgres DATABASE_URL always gets a Postgres client.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Same fallback Prisma itself uses: the project's .env file.
  for (const file of [".env", path.join("prisma", ".env")]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n#]+)"?/m);
    if (match) return match[1].trim();
  }
  return "";
}

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//i.test(url);
}

export function schemaPathFor(url) {
  return isPostgresUrl(url)
    ? path.join("prisma", "postgres", "schema.prisma")
    : path.join("prisma", "schema.prisma");
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/prisma-env.mjs <prisma command…>");
    process.exit(1);
  }
  const schema = schemaPathFor(databaseUrl());
  const command = `npx prisma ${args.join(" ")} --schema "${schema}"`;
  console.log(`[prisma-env] ${isPostgresUrl(databaseUrl()) ? "PostgreSQL" : "SQLite"} → ${schema}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}
