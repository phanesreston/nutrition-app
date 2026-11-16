"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { dayToDate, isIsoDay } from "@/lib/dates";
import { gramsForPortion } from "@/domain/calc/portion";
import { getCurrentUser } from "./auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_GRAMS = 10_000;

const amountSchema = z.object({
  /** "g" for grams, otherwise a FoodPortion id. */
  unit: z.string().min(1).max(64),
  quantity: z.coerce
    .number({ error: "Enter an amount" })
    .positive("Amount must be greater than zero")
    .max(MAX_GRAMS, "That amount is too large"),
  meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
});

const addSchema = amountSchema.extend({
  foodId: z.string().min(1).max(64),
  date: z.string().refine(isIsoDay, "Invalid date"),
});

const updateSchema = amountSchema.extend({ entryId: z.string().min(1).max(64) });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Resolve the unit to a label and gram weight from the database — never trust the client's weight. */
async function resolveUnit(foodId: string, unit: string) {
  if (unit === "g") return { unitLabel: "g", unitGrams: new Decimal(1) };
  const portion = await db.foodPortion.findFirst({ where: { id: unit, foodId } });
  if (!portion) return null;
  return { unitLabel: portion.label, unitGrams: new Decimal(portion.gramWeight.toString()) };
}

function revalidateDay() {
  revalidatePath("/", "layout");
}

export async function addDiaryEntry(input: z.input<typeof addSchema>): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { foodId, date, meal, unit, quantity } = parsed.data;

  const user = await getCurrentUser();
  const food = await db.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return { ok: false, error: "That food no longer exists" };
  const resolved = await resolveUnit(foodId, unit);
  if (!resolved) return { ok: false, error: "Unknown serving size" };

  const grams = gramsForPortion(quantity, resolved.unitGrams);
  if (grams.gt(MAX_GRAMS)) return { ok: false, error: "That amount is too large" };

  await db.diaryEntry.create({
    data: {
      userId: user.id,
      foodId,
      date: dayToDate(date),
      meal,
      quantity: new Decimal(quantity).toString(),
      unitLabel: resolved.unitLabel,
      unitGrams: resolved.unitGrams.toString(),
      grams: grams.toString(),
    },
  });
  revalidateDay();
  return { ok: true };
}

export async function updateDiaryEntry(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { entryId, meal, unit, quantity } = parsed.data;

  const user = await getCurrentUser();
  const entry = await db.diaryEntry.findFirst({ where: { id: entryId, userId: user.id } });
  if (!entry) return { ok: false, error: "Entry not found" };
  const resolved = await resolveUnit(entry.foodId, unit);
  if (!resolved) return { ok: false, error: "Unknown serving size" };

  const grams = gramsForPortion(quantity, resolved.unitGrams);
  if (grams.gt(MAX_GRAMS)) return { ok: false, error: "That amount is too large" };

  await db.diaryEntry.update({
    where: { id: entry.id },
    data: {
      meal,
      quantity: new Decimal(quantity).toString(),
      unitLabel: resolved.unitLabel,
      unitGrams: resolved.unitGrams.toString(),
      grams: grams.toString(),
    },
  });
  revalidateDay();
  return { ok: true };
}

export async function deleteDiaryEntry(entryId: string): Promise<ActionResult> {
  if (typeof entryId !== "string" || !entryId) return { ok: false, error: "Entry not found" };
  const user = await getCurrentUser();
  const { count } = await db.diaryEntry.deleteMany({ where: { id: entryId, userId: user.id } });
  if (count === 0) return { ok: false, error: "Entry not found" };
  revalidateDay();
  return { ok: true };
}

// ---------------------------------------------------------------- profile

/** Empty form fields arrive as "" and mean "not set". */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().pipe(schema).nullable());

const profileSchema = z.object({
  birthYear: optionalNumber(
    z
      .number()
      .int()
      .refine((y) => y >= new Date().getFullYear() - 110, "Check your year of birth")
      .refine((y) => y <= new Date().getFullYear() - 18, "Reference values here cover adults (18+) only"),
  ),
  sex: z.preprocess((v) => v || null, z.enum(["MALE", "FEMALE"]).nullable()),
  heightCm: optionalNumber(z.number().min(100, "Height must be at least 100 cm").max(250, "Height must be at most 250 cm")),
  weightKg: optionalNumber(z.number().min(30, "Weight must be at least 30 kg").max(300, "Weight must be at most 300 kg")),
  activityLevel: z.preprocess(
    (v) => v || null,
    z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]).nullable(),
  ),
  goal: z.preprocess((v) => v || null, z.enum(["LOSE", "MAINTAIN", "GAIN"]).nullable()),
  dietaryPreference: z.preprocess(
    (v) => v || null,
    z.enum(["omnivore", "pescatarian", "vegetarian", "vegan"]).nullable(),
  ),
  allergies: z.array(z.enum(["gluten", "milk", "egg", "peanut", "tree-nut", "soy", "fish", "shellfish", "sesame"])),
  energyTargetKcal: optionalNumber(z.number().int().min(800, "Energy target must be at least 800 kcal").max(8000)),
  proteinTargetG: optionalNumber(z.number().min(10).max(500)),
  carbsTargetG: optionalNumber(z.number().min(10).max(1500)),
  fatTargetG: optionalNumber(z.number().min(10).max(500)),
  fibreTargetG: optionalNumber(z.number().min(5).max(150)),
});

export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const user = await getCurrentUser();
  await db.profile.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
