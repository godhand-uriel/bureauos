import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration tests run against a dedicated SQLite database (prisma/test.db)
 * migrated in tests/global-setup.ts. Files run sequentially — SQLite and a
 * shared database make parallel suites race-prone for no local speed win.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      AUTH_SECRET: "vitest-secret-not-used-directly",
    },
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
