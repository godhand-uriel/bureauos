import { tmpdir } from "os";
import path from "path";

/**
 * The integration-test database lives in the OS temp directory — outside the
 * repository, so file-sync tools (OneDrive, Dropbox) can never lock it, and
 * CI runners get a clean location with no repo-relative assumptions.
 */
export const TEST_DB_DIR = path.join(tmpdir(), "bureauos-test");
export const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_PATH.replace(/\\/g, "/")}`;
