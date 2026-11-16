/**
 * Admin operations on foods. These functions contain all the rules
 * (validation, overrides, audit trail) and take the database and the acting
 * administrator as arguments; the server actions in ./actions.ts add the
 * authorisation check and cache invalidation around them.
 */
import Decimal from "decimal.js";
import type { PrismaClient } from "@prisma/client";
import { parseBarcode } from "@/domain/barcode";
import { NUTRIENTS, type NutrientKey } from "@/domain/nutrients/catalog";
import { MAX_PER_100 } from "@/domain/nutrients/limits";
import {
  effectiveValue,
  isOverrideField,
  matchesSource,
  sourceValue,
  type Override,
  type OverrideField,
} from "@/food-sources/merge";
import { loadOverrides, loadSource, materialiseFood, type Db } from "@/food-sources/store";
import type { NormalisedFood } from "@/food-sources/types";
import { snapshotNutrients } from "../snapshot";

export type FieldChange =
  /** Set the field. `value: null` means none / unknown. */
  | { field: string; value: string | null; estimated?: boolean }
  /** Drop the correction and go back to the imported value. */
  | { field: string; restore: true };

export type EditResult = { ok: true; changed: number } | { ok: false; error: string };

const TEXT_LIMITS = { name: 200, brand: 100, category: 100, description: 2000, ingredients: 4000 } as const;

const FIELD_LABELS: Record<string, string> = {
  name: "Product name",
  brand: "Brand",
  barcode: "Barcode",
  category: "Category",
  description: "Description",
  ingredients: "Ingredients",
  amountUnit: "Serving unit",
  servingSize: "Serving size",
  packageQuantity: "Package quantity",
  image: "Photograph",
  diary: "Diary entries",
};

export function fieldLabel(field: string): string {
  if (field.startsWith("n:")) return NUTRIENTS[field.slice(2) as NutrientKey]?.name ?? field;
  return FIELD_LABELS[field] ?? field;
}

class ValidationError extends Error {}

function parseAmount(raw: string, label: string, max: number, allowZero: boolean): string {
  const text = raw.trim().replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.?\d*$/.test(text)) throw new ValidationError(`${label}: enter a number`);
  const value = new Decimal(text);
  if (value.isNegative() || (!allowZero && value.isZero())) {
    throw new ValidationError(`${label}: must be ${allowZero ? "zero or more" : "greater than zero"}`);
  }
  if (value.gt(max)) throw new ValidationError(`${label}: ${text} is too large`);
  return value.toDecimalPlaces(4).toString();
}

/** Validate one submitted value and return it in stored form. Throws ValidationError. */
async function normaliseValue(
  db: Db,
  food: { id: string; createdByUserId: string | null },
  source: NormalisedFood,
  amountUnit: string,
  field: OverrideField,
  raw: string | null,
): Promise<string | null> {
  const text = raw?.trim() ?? "";
  const empty = text === "";

  switch (field) {
    case "name":
      if (empty) throw new ValidationError("Product name: cannot be empty");
    // falls through
    case "brand":
    case "category":
    case "description":
    case "ingredients": {
      if (empty) return null;
      const collapsed = field === "description" || field === "ingredients" ? text : text.replace(/\s+/g, " ");
      if (collapsed.length > TEXT_LIMITS[field]) {
        throw new ValidationError(`${fieldLabel(field)}: at most ${TEXT_LIMITS[field]} characters`);
      }
      return collapsed;
    }
    case "barcode": {
      if (empty) return null;
      const parsed = parseBarcode(text);
      if (!parsed) throw new ValidationError("Barcode: not a valid EAN or UPC number (check the last digit)");
      const clash = await db.food.findFirst({
        where: { barcode: parsed.code, id: { not: food.id }, createdByUserId: food.createdByUserId },
        select: { name: true },
      });
      if (clash) throw new ValidationError(`Barcode: already used by “${clash.name}”`);
      return parsed.code;
    }
    case "amountUnit":
      if (text !== "g" && text !== "ml") throw new ValidationError("Serving unit: choose g or ml");
      return text;
    case "servingSize":
      return empty ? null : parseAmount(text, "Serving size", 5000, false);
    case "packageQuantity":
      return empty ? null : parseAmount(text, "Package quantity", 100_000, false);
    case "image": {
      if (empty || text === "none") return "none";
      if (text === "source") {
        if (!source.imageUrl) throw new ValidationError("Photograph: this product has no original image");
        return "source";
      }
      const id = text.startsWith("upload:") ? text.slice("upload:".length) : "";
      const image = id ? await db.foodImage.findFirst({ where: { id, foodId: food.id } }) : null;
      if (!image) throw new ValidationError("Photograph: that image does not belong to this product");
      return `upload:${id}`;
    }
    default: {
      if (empty) return null; // unknown — deliberately not zero
      const def = NUTRIENTS[field.slice(2) as NutrientKey];
      const max = MAX_PER_100[def.unit];
      try {
        return parseAmount(text, def.name, max, true);
      } catch (error) {
        if (error instanceof ValidationError && error.message.endsWith("too large")) {
          throw new ValidationError(`${def.name}: ${text} ${def.unit} per 100 ${amountUnit} is not possible`);
        }
        throw error;
      }
    }
  }
}

/**
 * Apply a set of field changes to a food as overrides, write the audit
 * trail, and recompute the food's effective values. All-or-nothing: one
 * invalid field rejects the whole save.
 */
export async function applyFoodEdits(
  prisma: PrismaClient,
  adminId: string,
  foodId: string,
  changes: readonly FieldChange[],
  action: "edit" | "revert" = "edit",
): Promise<EditResult> {
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true, createdByUserId: true, amountUnit: true } });
  if (!food) return { ok: false, error: "That food no longer exists" };
  if (changes.length === 0) return { ok: true, changed: 0 };
  if (changes.length > 80) return { ok: false, error: "Too many changes in one save" };
  for (const change of changes) {
    if (!isOverrideField(change.field)) return { ok: false, error: `Unknown field “${change.field}”` };
  }

  try {
    const changed = await prisma.$transaction(async (tx) => {
      const source = await loadSource(tx, foodId);
      const overrides = await loadOverrides(tx, foodId);
      const unitChange = changes.find((c) => c.field === "amountUnit");
      const amountUnit = unitChange && "value" in unitChange && unitChange.value ? unitChange.value : food.amountUnit;
      let count = 0;

      for (const change of changes) {
        const field = change.field as OverrideField;
        const before = overrides.find((o) => o.field === field);
        const oldValue = effectiveValue(source, overrides, field);
        const key = { foodId_field: { foodId, field } };

        let newValue: string | null;
        let estimated = false;
        let auditAction: string = action;
        if ("restore" in change) {
          newValue = sourceValue(source, field);
          auditAction = "restore";
          if (before) await tx.foodOverride.delete({ where: key });
        } else {
          newValue = await normaliseValue(tx, food, source, amountUnit, field, change.value);
          estimated = Boolean(change.estimated) && field.startsWith("n:") && newValue !== null;
          // "No image" and "the source has no image" are the same thing.
          const sameAsSource =
            field === "image" ? (newValue === "none" ? !source.imageUrl : newValue === "source") : matchesSource(source, field, newValue);
          if (sameAsSource && !estimated) {
            // The value is what the source already says: no correction needed.
            if (before) await tx.foodOverride.delete({ where: key });
          } else {
            await tx.foodOverride.upsert({
              where: key,
              update: { value: newValue, estimated, updatedBy: adminId },
              create: { foodId, field, value: newValue, estimated, updatedBy: adminId },
            });
          }
        }

        const comparableOld = field === "image" ? (oldValue ?? "none") : oldValue;
        const comparableNew = field === "image" ? (newValue ?? "none") : newValue;
        const flagChanged = Boolean(before?.estimated) !== estimated;
        if (comparableOld === comparableNew && !flagChanged) continue;
        await tx.foodAudit.create({
          data: { foodId, field, oldValue: comparableOld, newValue: comparableNew, action: auditAction, adminId },
        });
        count++;
        // Keep the in-memory list current for later changes in the same save.
        const index = overrides.findIndex((o) => o.field === field);
        if (index >= 0) overrides.splice(index, 1);
        const stored = await tx.foodOverride.findUnique({ where: key });
        if (stored) overrides.push({ field, value: stored.value, estimated: stored.estimated } satisfies Override);
      }

      await materialiseFood(tx, foodId);
      if (count > 0) await tx.food.update({ where: { id: foodId }, data: { editedAt: new Date() } });
      return count;
    });
    return { ok: true, changed };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Undo one audited change by setting the field back to its previous value. */
export async function revertAudit(prisma: PrismaClient, adminId: string, auditId: string): Promise<EditResult> {
  const audit = await prisma.foodAudit.findUnique({ where: { id: auditId } });
  if (!audit) return { ok: false, error: "That history entry no longer exists" };
  if (!isOverrideField(audit.field)) return { ok: false, error: "That kind of change cannot be reverted" };
  return applyFoodEdits(prisma, adminId, audit.foodId, [{ field: audit.field, value: audit.oldValue }], "revert");
}

/**
 * Explicitly update every existing diary entry of a food to the food's
 * current values. This is the only way past entries change.
 */
export async function recalculateDiaryEntries(
  prisma: PrismaClient,
  adminId: string,
  foodId: string,
): Promise<{ ok: true; entries: number } | { ok: false; error: string }> {
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return { ok: false, error: "That food no longer exists" };
  const entries = await prisma.$transaction(async (tx) => {
    const per100g = await snapshotNutrients(tx, foodId);
    const { count } = await tx.diaryEntry.updateMany({ where: { foodId }, data: { per100g } });
    await tx.foodAudit.create({
      data: { foodId, field: "diary", oldValue: null, newValue: `${count} past entries recalculated`, action: "recalculate", adminId },
    });
    return count;
  });
  return { ok: true, entries };
}
