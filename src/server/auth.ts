import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";

export const LOCAL_USER_EMAIL = "local@nutrition.app";

/**
 * The single seam for authentication. The first prototype is a local,
 * single-user app, so this returns the seeded local user. Replacing the body
 * with a session lookup (e.g. Auth.js) makes the app multi-user: every query
 * is already scoped by the returned user id.
 */
export const getCurrentUser = cache(async () => {
  // All user data is request-time data: never prerender it into the static shell.
  await connection();
  return db.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL, name: "Local user", profile: { create: {} } },
  });
});
