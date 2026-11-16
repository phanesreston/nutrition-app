import Decimal from "decimal.js";
import { NUTRIENTS, type NutrientKey } from "@/domain/nutrients/catalog";
import { convertAmount } from "@/domain/nutrients/units";
import type { FoodSourceAdapter, NormalisedFood, NormalisedPortion } from "../types";

/** The subset of the FoodData Central JSON download format that we read. */
export interface FdcFood {
  fdcId: number;
  description: string;
  foodCategory?: { description?: string };
  foodNutrients: { nutrient: { id: number; name: string; unitName: string }; amount?: number | null }[];
  foodPortions?: {
    amount?: number | null;
    modifier?: string | null;
    gramWeight?: number | null;
    sequenceNumber?: number | null;
    measureUnit?: { name?: string | null };
  }[];
}

/**
 * FoodData Central nutrient ids -> catalogue keys.
 * Ids are stable across FDC data types (SR Legacy, Foundation, Survey).
 */
export const FDC_NUTRIENT_IDS: Record<number, NutrientKey> = {
  1008: "energy", // Energy (kcal)
  1003: "protein",
  1005: "carbs", // Carbohydrate, by difference
  1004: "fat", // Total lipid (fat)
  1079: "fibre", // Fiber, total dietary
  2000: "sugars",
  1258: "saturatedFat",
  1106: "vitaminA", // Vitamin A, RAE (µg)
  1105: "retinol",
  1165: "thiamin",
  1166: "riboflavin",
  1167: "niacin",
  1170: "pantothenicAcid",
  1175: "vitaminB6",
  1176: "biotin", // not present in SR Legacy; reported by some Foundation Foods
  1190: "folate", // Folate, DFE
  1186: "folicAcid",
  1178: "vitaminB12",
  1162: "vitaminC",
  1114: "vitaminD", // Vitamin D (D2 + D3), µg
  1109: "vitaminE", // alpha-tocopherol
  1185: "vitaminK", // phylloquinone
  1087: "calcium",
  1089: "iron",
  1090: "magnesium",
  1092: "potassium",
  1093: "sodium",
  1095: "zinc",
  1103: "selenium",
  1098: "copper",
  1101: "manganese",
  1091: "phosphorus",
  1100: "iodine", // not present in SR Legacy
};

const DISTRIBUTION_SUFFIX = " (Includes foods for USDA's Food Distribution Program)";

/** SR Legacy descriptions carry an administrative suffix that is noise for users. */
export function cleanDescription(description: string): string {
  return description.replace(DISTRIBUTION_SUFFIX, "").trim();
}

function portionLabel(p: NonNullable<FdcFood["foodPortions"]>[number]): string {
  const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
  const amount = p.amount ?? 1;
  return [String(amount), unit, p.modifier ?? ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export const usdaSrLegacy: FoodSourceAdapter<FdcFood> = {
  info: {
    id: "usda-sr-legacy",
    name: "USDA National Nutrient Database for Standard Reference, Legacy Release",
    version: "April 2018 (FoodData Central download 2018-04)",
    publisher: "U.S. Department of Agriculture, Agricultural Research Service",
    license: "Public domain (CC0 1.0)",
    url: "https://fdc.nal.usda.gov/download-datasets",
  },

  normalise(raw: FdcFood): NormalisedFood | null {
    const nutrients: NormalisedFood["nutrients"] = {};
    for (const fn of raw.foodNutrients) {
      const key = FDC_NUTRIENT_IDS[fn.nutrient.id];
      if (!key) continue;
      // An absent amount means "not reported": leave the nutrient missing.
      if (fn.amount === null || fn.amount === undefined || Number.isNaN(fn.amount)) continue;
      const unit = NUTRIENTS[key].unit;
      nutrients[key] = { amount: convertAmount(new Decimal(fn.amount), fn.nutrient.unitName, unit).toString(), unit };
    }
    // A food without an energy value cannot be logged meaningfully.
    if (!nutrients.energy) return null;

    const portions: NormalisedPortion[] = (raw.foodPortions ?? [])
      .filter((p) => typeof p.gramWeight === "number" && p.gramWeight > 0)
      .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))
      .map((p) => ({ label: portionLabel(p), gramWeight: new Decimal(p.gramWeight as number).toString() }));

    return {
      sourceId: this.info.id,
      sourceFoodId: String(raw.fdcId),
      name: cleanDescription(raw.description),
      category: raw.foodCategory?.description ?? null,
      nutrients,
      portions,
    };
  },
};
