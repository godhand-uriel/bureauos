import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";

/** Fresh test database per run: delete, then apply the committed migrations. */
export default function setup() {
  const dbPath = path.resolve(__dirname, "../prisma/test.db");
  for (const suffix of ["", "-journal"]) {
    try {
      rmSync(dbPath + suffix, { force: true });
    } catch {
      // OneDrive can transiently lock the file; migrate deploy still works
      // against the existing schema in that case.
    }
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
