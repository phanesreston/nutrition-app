import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./test-db.mts";

/** Create (if needed) and migrate the test database before any test runs. */
export default function setup() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
