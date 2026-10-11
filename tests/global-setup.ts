import { execSync } from "child_process";
import { mkdirSync, rmSync } from "fs";
import { TEST_DATABASE_URL, TEST_DB_DIR, TEST_DB_PATH } from "./test-db";

/** Fresh test database per run: delete, then apply the committed migrations. */
export default function setup() {
  mkdirSync(TEST_DB_DIR, { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(TEST_DB_PATH + suffix, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
