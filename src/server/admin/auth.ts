import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";
import { getCurrentUser } from "../auth";
import { ADMIN_COOKIE, SESSION_TTL_MS, adminConfig, createSessionToken, verifySessionToken } from "./session";

export interface Admin {
  /** Recorded as "administrator responsible" in the audit log. */
  id: string;
  name: string;
}

/**
 * The administrator making this request, or null. This is the only check
 * that grants admin rights; every admin page, action and endpoint calls it
 * (directly or through the helpers below) on the server.
 */
export async function getAdmin(): Promise<Admin | null> {
  const config = adminConfig();
  if (!config.enabled) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (verifySessionToken(token, config.password) !== "admin") return null;
  const user = await getCurrentUser();
  return { id: user.id, name: user.name ?? user.email };
}

/** For pages: send anyone who is not an administrator to the sign-in page. */
export async function requireAdminPage(returnTo: string): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  return admin;
}

export async function startAdminSession(): Promise<void> {
  const config = adminConfig();
  if (!config.enabled) throw new Error("Admin access is not configured");
  const proto = (await headers()).get("x-forwarded-proto");
  (await cookies()).set(ADMIN_COOKIE, createSessionToken(config.password), {
    httpOnly: true,
    sameSite: "lax",
    // Only mark Secure when the request really arrived over HTTPS; on plain HTTP a Secure cookie is dropped.
    secure: proto === "https",
    path: BASE_PATH || "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: BASE_PATH || "/", maxAge: 0 });
}
