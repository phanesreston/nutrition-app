import Decimal from "decimal.js";
import { NUTRIENT_KEYS, type NutrientKey } from "../nutrients/catalog";
import { scalePer100g } from "./portion";

/** Per-100 g values for one food. A key that is absent or null is "unknown". */
export type Composition = Partial<Record<NutrientKey, Decimal.Value | null>>;

export interface IntakeItem {
  /** Stable identifier of the logged item (diary entry id). */
  id: string;
  label: string;
  grams: Decimal.Value;
  per100g: Composition;
}

export interface NutrientContribution {
  itemId: string;
  label: string;
  amount: Decimal;
}

export interface NutrientIntake {
  /** Sum over the items that have a value. A lower bound when `missing` is non-empty. */
  total: Decimal;
  /** Items that contributed a known value (including a true zero). */
  contributions: NutrientContribution[];
  /** Labels of items whose value for this nutrient is unknown. */
  missing: { itemId: string; label: string }[];
}

export type IntakeSummary = Record<NutrientKey, NutrientIntake>;

/**
 * Sum nutrient intake across logged items.
 *
 * Unknown values are tracked separately instead of being treated as zero, so
 * callers can tell "none eaten" apart from "we don't know".
 */
export function summariseIntake(items: readonly IntakeItem[]): IntakeSummary {
  const summary = {} as IntakeSummary;
  for (const key of NUTRIENT_KEYS) {
    summary[key] = { total: new Decimal(0), contributions: [], missing: [] };
  }
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) {
      const amount = scalePer100g(item.per100g[key], item.grams);
      const entry = summary[key];
      if (amount === null) {
        entry.missing.push({ itemId: item.id, label: item.label });
      } else {
        entry.total = entry.total.plus(amount);
        entry.contributions.push({ itemId: item.id, label: item.label, amount });
      }
    }
  }
  return summary;
}

export type DataCoverage = "none-logged" | "complete" | "partial" | "no-data";

/** How much of the logged food has a known value for this nutrient. */
export function dataCoverage(intake: NutrientIntake): DataCoverage {
  const known = intake.contributions.length;
  const unknown = intake.missing.length;
  if (known === 0 && unknown === 0) return "none-logged";
  if (unknown === 0) return "complete";
  if (known === 0) return "no-data";
  return "partial";
}

/** Atwater general factors (kcal per gram). */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Share of energy (0–1) supplied by each macronutrient, or null if nothing is logged. */
export function macroEnergySplit(grams: { protein: Decimal.Value; carbs: Decimal.Value; fat: Decimal.Value }) {
  const protein = new Decimal(grams.protein).times(KCAL_PER_GRAM.protein);
  const carbs = new Decimal(grams.carbs).times(KCAL_PER_GRAM.carbs);
  const fat = new Decimal(grams.fat).times(KCAL_PER_GRAM.fat);
  const total = protein.plus(carbs).plus(fat);
  if (total.isZero()) return null;
  return { protein: protein.div(total), carbs: carbs.div(total), fat: fat.div(total) };
}
