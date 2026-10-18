import { tmpdir } from "os";
import path from "path";

/**
 * Which database the integration tests run against.
 *
 * Default: a SQLite file in the OS temp directory — outside the repository,
 * so file-sync tools (OneDrive, Dropbox) can never lock it, and CI runners
 * get a clean location with no repo-relative assumptions.
 *
 * PostgreSQL: set TEST_DATABASE_URL to a postgres:// URL to run the same
 * suite against the production engine (CI does this with a service
 * container). Because the suite wipes and re-migrates its database, the
 * database name must end in `_test` or `_verify` — a guard against pointing
 * it at something real.
 */
export const TEST_DB_DIR = path.join(tmpdir(), "bureauos-test");
export const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

const override = process.env.TEST_DATABASE_URL ?? "";
export const TEST_IS_POSTGRES = /^postgres(ql)?:\/\//i.test(override);

if (TEST_IS_POSTGRES) {
  const dbName = new URL(override).pathname.replace(/^\//, "");
  if (!/(_test|_verify)$/.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL points at database "${dbName}". The test suite erases its database, ` +
        "so the name must end in _test or _verify.",
    );
  }
}

export const TEST_DATABASE_URL = TEST_IS_POSTGRES
  ? override
  : `file:${TEST_DB_PATH.replace(/\\/g, "/")}`;

export const TEST_SCHEMA_PATH = TEST_IS_POSTGRES
  ? path.join("prisma", "postgres", "schema.prisma")
  : path.join("prisma", "schema.prisma");
