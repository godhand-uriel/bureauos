#!/usr/bin/env node
/**
 * Generate prisma/postgres/schema.prisma from prisma/schema.prisma.
 *
 *   npm run db:sync            write the PostgreSQL schema
 *   npm run db:sync -- --check exit 1 if it is out of date (used by CI and tests)
 *
 * The data model is written once, in prisma/schema.prisma (SQLite). The
 * PostgreSQL schema is that same model with the datasource provider swapped —
 * the model deliberately uses only types both engines share, so no other
 * transformation is needed. Do not edit the generated file by hand.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE = path.join("prisma", "schema.prisma");
const TARGET = path.join("prisma", "postgres", "schema.prisma");

const HEADER = `// GENERATED FILE — DO NOT EDIT.
// Source of truth: prisma/schema.prisma. Regenerate with \`npm run db:sync\`.
// This is the PostgreSQL (production) variant of the BureauOS data model;
// its migrations live in prisma/postgres/migrations.
`;

export function toPostgresSchema(sqliteSchema) {
  const normalized = sqliteSchema.replace(/\r\n/g, "\n");
  const datasource = /datasource\s+db\s*\{[^}]*\}/.exec(normalized);
  if (!datasource || !/provider\s*=\s*"sqlite"/.test(datasource[0])) {
    throw new Error(`${SOURCE}: expected a datasource block with provider = "sqlite".`);
  }
  // Drop the leading comment block (it describes the SQLite file) and swap the provider.
  const body = normalized.slice(datasource.index).replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  return `${HEADER}\n${body}`;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (invokedDirectly) {
  const expected = toPostgresSchema(readFileSync(SOURCE, "utf8"));
  const current = existsSync(TARGET) ? readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n") : null;

  if (process.argv.includes("--check")) {
    if (current !== expected) {
      console.error(`${TARGET} is out of date. Run \`npm run db:migration:new -- <name>\` (or \`npm run db:sync\`).`);
      process.exit(1);
    }
    console.log(`${TARGET} is in sync with ${SOURCE}.`);
  } else if (current === expected) {
    console.log(`${TARGET} already in sync.`);
  } else {
    mkdirSync(path.dirname(TARGET), { recursive: true });
    writeFileSync(TARGET, expected, "utf8");
    console.log(`Wrote ${TARGET}.`);
  }
}
