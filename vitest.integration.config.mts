import path from "node:path";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/integration/test-db.mts";

// Integration tests run against a real PostgreSQL database, created and migrated automatically.

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // "server-only" throws outside a React Server Components build.
      "server-only": path.resolve(root, "tests/integration/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      ADMIN_PASSWORD: "integration-test-password",
      UPLOAD_DIR: path.resolve(root, "node_modules/.cache/nourish-test-uploads"),
    },
  },
});
