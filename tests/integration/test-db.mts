import { config as loadEnv } from "dotenv";

/**
 * The database integration tests use: TEST_DATABASE_URL, or DATABASE_URL
 * with "_test" appended to the database name — never the development one.
 */
export function testDatabaseUrl(): string {
  loadEnv({ quiet: true });
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://nutrition:nutrition@localhost:5432/nutrition");
  url.pathname = `${url.pathname.replace(/_test$/, "")}_test`;
  return url.toString();
}
