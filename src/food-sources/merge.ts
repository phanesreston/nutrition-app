/**
 * Combines a food's imported record with an administrator's corrections.
 *
 * Value priority, highest first:
 *   1. administrator override (optionally flagged as the admin's estimate)
 *   2. manufacturer-reported data — values declared on the pack ("label")
 *   3. imported reference data — a reference database such as USDA ("reference")
 *   4. estimated data from a source (none is imported today; see docs)
 *   5. unknown
 *
 * A food has exactly one imported record, so tiers 2–4 never compete with
 * each other for the same food: the rule that matters in practice is that
 * an override always beats whatever the source says, and removing the
 * override brings the source value back.
 *
 * Pure functions only — no database access — so the rules are unit-tested.
 */
import Decimal from "decimal.js";
import { NUTRIENTS, isNutrientKey, type NutrientKey } from "@/domain/nutrients/catalog";
import type { NormalisedFood, NormalisedPortion } from "./types";

export const SERVING_LABEL = "1 serving";
export const PACKAGE_LABEL = "1 package";

export const TEXT_FIELDS = ["name", "brand", "barcode", "category", "description", "ingredients"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type OverrideField = TextField | "amountUnit" | "servingSize" | "packageQuantity" | "image" | `n:${NutrientKey}`;

export interface Override {
  field: string;
  /** Null means "explicitly none": an unknown nutrient, an empty text field, no serving. */
  value: string | null;
  estimated?: boolean;
}

/** Where an effective nutrient value comes from. */
export type ValueOrigin = "admin" | "admin-estimate" | "label" | "reference" | "user";

export type FieldStatus =
  /** The imported value, untouched. */
  | "original"
  /** Changed by an administrator. */
  | "corrected"
  /** Changed by an administrator and flagged as an estimate. */
  | "estimated"
  /** No value: the source has none and nobody has entered one. */
  | "unknown";

export function nutrientField(key: NutrientKey): `n:${NutrientKey}` {
  return `n:${key}`;
}

export function isOverrideField(field: string): field is OverrideField {
  if ((TEXT_FIELDS as readonly string[]).includes(field)) return true;
  if (field === "amountUnit" || field === "servingSize" || field === "packageQuantity" || field === "image") return true;
  return field.startsWith("n:") && isNutrientKey(field.slice(2));
}

/** How the values in a source database should be labelled. */
export function sourceOrigin(sourceId: string): ValueOrigin {
  if (sourceId === "open-food-facts") return "label";
  if (sourceId === "custom") return "user";
  return "reference";
}

/** Path the app serves an uploaded image from (without any base path). */
export function uploadedImageUrl(imageId: string): string {
  return `/api/images/${imageId}`;
}

const portionWeight = (portions: readonly NormalisedPortion[], label: string) =>
  portions.find((p) => p.label === label)?.gramWeight ?? null;

/** Canonical decimal string, so "12", "12.0" and "12.0000" compare equal. */
export function canonicalNumber(value: string): string {
  return new Decimal(value).toDecimalPlaces(4).toString();
}

/** The imported value of a field as a string, or null when the source has none. */
export function sourceValue(source: NormalisedFood, field: OverrideField): string | null {
  switch (field) {
    case "name":
      return source.name;
    case "brand":
    case "barcode":
    case "category":
    case "description":
    case "ingredients":
      return source[field] ?? null;
    case "amountUnit":
      return source.amountUnit ?? "g";
    case "servingSize":
      return portionWeight(source.portions, SERVING_LABEL);
    case "packageQuantity":
      return portionWeight(source.portions, PACKAGE_LABEL);
    case "image":
      return source.imageUrl ? "source" : null;
    default: {
      const amount = source.nutrients[field.slice(2) as NutrientKey]?.amount;
      return amount === undefined ? null : canonicalNumber(amount);
    }
  }
}

function withPortion(portions: NormalisedPortion[], label: string, weight: string | null): NormalisedPortion[] {
  const rest = portions.filter((p) => p.label !== label);
  if (weight === null) return rest;
  const portion = { label, gramWeight: weight };
  // Keep "1 serving" first and "1 package" right after it.
  if (label === SERVING_LABEL) return [portion, ...rest];
  const servingIndex = rest.findIndex((p) => p.label === SERVING_LABEL);
  return [...rest.slice(0, servingIndex + 1), portion, ...rest.slice(servingIndex + 1)];
}

export interface MergedFood {
  /** The effective record: what the rest of the app reads. */
  food: NormalisedFood;
  nutrientOrigins: Partial<Record<NutrientKey, ValueOrigin>>;
}

/** Apply overrides on top of an imported record. Unknown override fields are ignored. */
export function mergeFood(source: NormalisedFood, overrides: readonly Override[]): MergedFood {
  const base = sourceOrigin(source.sourceId);
  const food: NormalisedFood = {
    ...source,
    amountUnit: source.amountUnit ?? "g",
    nutrients: { ...source.nutrients },
    portions: [...source.portions],
  };
  const nutrientOrigins: MergedFood["nutrientOrigins"] = {};
  for (const key of Object.keys(source.nutrients)) {
    if (isNutrientKey(key)) nutrientOrigins[key] = base;
  }

  for (const override of overrides) {
    const { field, value } = override;
    if (!isOverrideField(field)) continue;
    switch (field) {
      case "name":
        if (value) food.name = value; // a food always has a name
        break;
      case "brand":
      case "barcode":
      case "category":
      case "description":
      case "ingredients":
        food[field] = value;
        break;
      case "amountUnit":
        food.amountUnit = value === "ml" ? "ml" : "g";
        break;
      case "servingSize":
        food.portions = withPortion(food.portions, SERVING_LABEL, value);
        break;
      case "packageQuantity":
        food.portions = withPortion(food.portions, PACKAGE_LABEL, value);
        break;
      case "image":
        if (value === null || value === "none") food.imageUrl = null;
        else if (value.startsWith("upload:")) food.imageUrl = uploadedImageUrl(value.slice("upload:".length));
        else food.imageUrl = source.imageUrl ?? null; // "source"
        break;
      default: {
        const key = field.slice(2) as NutrientKey;
        if (value === null) {
          delete food.nutrients[key];
          delete nutrientOrigins[key];
        } else {
          food.nutrients[key] = { amount: canonicalNumber(value), unit: NUTRIENTS[key].unit };
          nutrientOrigins[key] = override.estimated ? "admin-estimate" : "admin";
        }
      }
    }
  }
  return { food, nutrientOrigins };
}

/** The effective value of one field after overrides, as a string (null = none). */
export function effectiveValue(source: NormalisedFood, overrides: readonly Override[], field: OverrideField): string | null {
  const override = overrides.find((o) => o.field === field);
  if (!override) return sourceValue(source, field);
  if (field === "image") return override.value ?? "none";
  return override.value;
}

export function fieldStatus(source: NormalisedFood, overrides: readonly Override[], field: OverrideField): FieldStatus {
  const override = overrides.find((o) => o.field === field);
  if (override) return override.estimated && override.value !== null ? "estimated" : "corrected";
  return sourceValue(source, field) === null ? "unknown" : "original";
}

/**
 * Whether `value` is the same as what the source already says — in which
 * case no override is needed and an existing one should be removed.
 */
export function matchesSource(source: NormalisedFood, field: OverrideField, value: string | null): boolean {
  const original = sourceValue(source, field);
  if (original === null || value === null) return original === value;
  if (field.startsWith("n:") || field === "servingSize" || field === "packageQuantity") {
    return canonicalNumber(original) === canonicalNumber(value);
  }
  return original === value;
}
