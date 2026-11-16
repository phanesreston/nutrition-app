"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { dayToDate, isIsoDay } from "@/lib/dates";
import { parseBarcode } from "@/domain/barcode";
import { gramsForPortion } from "@/domain/calc/portion";
import { NUTRIENTS, isNutrientKey, type NutrientKey, type Unit } from "@/domain/nutrients/catalog";
import { getCurrentUser } from "./auth";
import { forgetNotFound } from "./barcode";

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
  if (unit === "g") {
    // The base unit: grams, or millilitres for foods whose values are per 100 ml.
    const food = await db.food.findUnique({ where: { id: foodId }, select: { amountUnit: true } });
    return { unitLabel: food?.amountUnit === "ml" ? "ml" : "g", unitGrams: new Decimal(1) };
  }
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
  const food = await db.food.findUnique({ where: { id: foodId }, select: { createdByUserId: true } });
  if (!food || (food.createdByUserId !== null && food.createdByUserId !== user.id)) {
    return { ok: false, error: "That food no longer exists" };
  }
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

// ------------------------------------------------------------ custom foods

/** A per-100 value above this is physically impossible, so it is a typo. */
const MAX_PER_100: Record<Unit, number> = { kcal: 900, g: 100, mg: 100_000, "µg": 100_000_000 };

/** Sodium (mg) per gram of salt: salt = sodium × 2.5 (Regulation (EU) No 1169/2011). */
const SODIUM_MG_PER_G_SALT = 400;

const customFoodSchema = z.object({
  name: z.string().trim().min(1, "Give the food a name").max(120),
  brand: z.string().trim().max(100).optional(),
  barcode: z.string().trim().max(32).optional(),
  amountUnit: z.enum(["g", "ml"]),
  /** Size of one serving in g or ml; empty for none. */
  servingSize: optionalNumber(z.number().positive("Serving size must be greater than zero").max(5000)),
  /** Salt in g per 100, as printed on EU labels. Converted to sodium. */
  saltG: optionalNumber(z.number().min(0).max(100, "Salt cannot exceed 100 g per 100 g")),
  /** Per-100 values keyed by nutrient, in the catalogue unit. Empty string = not known. */
  nutrients: z.record(z.string(), z.union([z.string(), z.number()])),
});

export type CustomFoodInput = z.input<typeof customFoodSchema>;

export type CustomFoodResult = { ok: true; foodId: string } | { ok: false; error: string };

/**
 * Create (or replace) the user's own food, optionally tied to a barcode so
 * future scans find it. Only values the user actually entered are stored.
 */
export async function saveCustomFood(input: CustomFoodInput): Promise<CustomFoodResult> {
  const parsed = customFoodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;

  let barcode: string | null = null;
  if (data.barcode) {
    const code = parseBarcode(data.barcode);
    if (!code) return { ok: false, error: "That barcode is not valid" };
    barcode = code.code;
  }

  const nutrients: { nutrientKey: NutrientKey; amount: string; unit: Unit }[] = [];
  for (const [key, raw] of Object.entries(data.nutrients)) {
    if (!isNutrientKey(key)) continue;
    if (raw === "" || raw === null || raw === undefined) continue; // not entered: stays unknown
    const value = Number(raw);
    const def = NUTRIENTS[key];
    if (!Number.isFinite(value) || value < 0) return { ok: false, error: `${def.name}: enter a number of zero or more` };
    if (value > MAX_PER_100[def.unit]) {
      return { ok: false, error: `${def.name}: ${value} ${def.unit} per 100 ${data.amountUnit} is not possible` };
    }
    nutrients.push({ nutrientKey: key, amount: new Decimal(String(raw).trim()).toDecimalPlaces(4).toString(), unit: def.unit });
  }
  if (data.saltG !== null && !nutrients.some((n) => n.nutrientKey === "sodium")) {
    nutrients.push({
      nutrientKey: "sodium",
      amount: new Decimal(data.saltG).times(SODIUM_MG_PER_G_SALT).toDecimalPlaces(4).toString(),
      unit: "mg",
    });
  }
  if (!nutrients.some((n) => n.nutrientKey === "energy")) {
    return { ok: false, error: "Enter at least the energy (kcal) from the label" };
  }

  const user = await getCurrentUser();
  await db.foodSource.upsert({
    where: { id: "custom" },
    update: {},
    create: {
      id: "custom",
      name: "Custom foods",
      version: "User-entered",
      publisher: "Entered by you",
      license: "Private to your account",
      url: "",
    },
  });

  const existing = barcode ? await db.food.findFirst({ where: { barcode, createdByUserId: user.id } }) : null;
  const fields = {
    name: data.name,
    brand: data.brand || null,
    barcode,
    amountUnit: data.amountUnit,
    category: "Custom food",
  };

  const foodId = await db.$transaction(async (tx) => {
    const food = existing
      ? await tx.food.update({ where: { id: existing.id }, data: fields })
      : await tx.food.create({
          data: { ...fields, sourceId: "custom", sourceFoodId: crypto.randomUUID(), createdByUserId: user.id },
        });
    await tx.foodNutrient.deleteMany({ where: { foodId: food.id } });
    await tx.foodPortion.deleteMany({ where: { foodId: food.id } });
    await tx.foodNutrient.createMany({ data: nutrients.map((n) => ({ ...n, foodId: food.id })) });
    if (data.servingSize !== null) {
      await tx.foodPortion.create({
        data: { foodId: food.id, label: "1 serving", gramWeight: new Decimal(data.servingSize).toString() },
      });
    }
    return food.id;
  });

  if (barcode) forgetNotFound(barcode);
  revalidatePath("/", "layout");
  return { ok: true, foodId };
}
