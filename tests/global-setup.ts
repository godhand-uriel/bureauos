import { execSync } from "child_process";
import { mkdirSync, rmSync } from "fs";
import { TEST_DATABASE_URL, TEST_DB_DIR, TEST_DB_PATH, TEST_IS_POSTGRES, TEST_SCHEMA_PATH } from "./test-db";

const run = (command: string, env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: TEST_DATABASE_URL }) =>
  execSync(command, { env, stdio: "pipe" });

/**
 * Prepare the test database from the committed migrations for the engine
 * under test — so every run also proves the migrations apply.
 *
 * SQLite: the database file is deleted and rebuilt each run.
 * PostgreSQL: migrations are applied with `migrate deploy`, which never drops
 * anything. Start from an empty database (CI uses a fresh service container;
 * locally, a throwaway container). Each test file clears the rows it needs
 * to; no schema is ever reset from here.
 *
 * The Prisma client is engine-specific, so it is generated for the engine
 * under test first and, after a PostgreSQL run, restored for local development.
 */
export default function setup() {
  run(`npx prisma generate --schema "${TEST_SCHEMA_PATH}"`);

  if (!TEST_IS_POSTGRES) {
    mkdirSync(TEST_DB_DIR, { recursive: true });
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      rmSync(TEST_DB_PATH + suffix, { force: true });
    }
  }

  run(`npx prisma migrate deploy --schema "${TEST_SCHEMA_PATH}"`);

  if (TEST_IS_POSTGRES) {
    return () => {
      // Put back the client that matches the developer's own DATABASE_URL.
      const rest = { ...process.env };
      delete rest.TEST_DATABASE_URL;
      delete rest.DATABASE_URL;
      execSync("node scripts/prisma-env.mjs generate", { env: rest, stdio: "pipe" });
    };
  }
}
