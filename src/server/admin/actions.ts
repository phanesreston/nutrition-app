"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { forgetNotFound } from "../barcode";
import { endAdminSession, getAdmin, startAdminSession } from "./auth";
import { applyFoodEdits, recalculateDiaryEntries, revertAudit, type EditResult, type FieldChange } from "./food-admin";
import { LoginThrottle, adminConfig, passwordMatches } from "./session";

const NOT_AUTHORISED = { ok: false as const, error: "You are not signed in as an administrator" };

const throttle = new LoginThrottle();

/** Only allow redirects back into the admin area. */
function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/admin(\/[\w\-/]*)?$/.test(next) ? next : "/admin";
}

export async function adminLogin(_previous: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const config = adminConfig();
  if (!config.enabled) return { error: "Admin access is not configured on this server." };
  if (throttle.isLocked()) return { error: "Too many failed attempts. Try again in 15 minutes." };
  const password = form.get("password");
  if (typeof password !== "string" || !passwordMatches(password, config.password)) {
    throttle.recordFailure();
    return { error: "That password is not correct." };
  }
  throttle.reset();
  await startAdminSession();
  redirect(safeNext(form.get("next")));
}

export async function adminLogout(): Promise<void> {
  await endAdminSession();
  redirect("/");
}

/** Everything that shows food data is re-rendered, and barcode lookups see the new values at once. */
async function invalidateFood(foodId: string) {
  const food = await db.food.findUnique({ where: { id: foodId }, select: { barcode: true } });
  if (food?.barcode) forgetNotFound(food.barcode);
  revalidatePath("/", "layout");
}

export async function saveFoodEdits(foodId: string, changes: FieldChange[]): Promise<EditResult> {
  const admin = await getAdmin();
  if (!admin) return NOT_AUTHORISED;
  if (typeof foodId !== "string" || !Array.isArray(changes)) return { ok: false, error: "Invalid request" };
  const clean: FieldChange[] = [];
  for (const c of changes) {
    if (!c || typeof c.field !== "string") return { ok: false, error: "Invalid request" };
    if ("restore" in c) clean.push({ field: c.field, restore: true });
    else if (c.value === null || typeof c.value === "string") {
      clean.push({ field: c.field, value: c.value === null ? null : c.value.slice(0, 5000), estimated: c.estimated === true });
    } else return { ok: false, error: "Invalid request" };
  }
  const result = await applyFoodEdits(db, admin.id, foodId, clean);
  if (result.ok) await invalidateFood(foodId);
  return result;
}

export async function revertFoodChange(auditId: string): Promise<EditResult> {
  const admin = await getAdmin();
  if (!admin) return NOT_AUTHORISED;
  if (typeof auditId !== "string") return { ok: false, error: "Invalid request" };
  const audit = await db.foodAudit.findUnique({ where: { id: auditId }, select: { foodId: true } });
  const result = await revertAudit(db, admin.id, auditId);
  if (result.ok && audit) await invalidateFood(audit.foodId);
  return result;
}

export async function recalculateFoodDiary(
  foodId: string,
): Promise<{ ok: true; entries: number } | { ok: false; error: string }> {
  const admin = await getAdmin();
  if (!admin) return NOT_AUTHORISED;
  if (typeof foodId !== "string") return { ok: false, error: "Invalid request" };
  const result = await recalculateDiaryEntries(db, admin.id, foodId);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
