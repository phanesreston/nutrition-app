import Decimal from "decimal.js";
import { NUTRIENTS, type NutrientKey } from "@/domain/nutrients/catalog";
import { convertAmount } from "@/domain/nutrients/units";
import type { FoodSourceInfo, NormalisedFood, NormalisedPortion } from "../types";
import type { OffProduct } from "./client";

export const openFoodFactsInfo: FoodSourceInfo = {
  id: "open-food-facts",
  name: "Open Food Facts",
  version: "Live API v3 (fetched per product)",
  publisher: "Open Food Facts contributors",
  license: "Open Database License (ODbL) 1.0; contents under the Database Contents License; images CC BY-SA",
  url: "https://world.openfoodfacts.org",
};

/**
 * Open Food Facts `nutriments` ids -> catalogue keys. The API normalises
 * every `<id>_100g` mass value to GRAMS (e.g. iron_100g = 0.012 means 12 mg)
 * and energy-kcal to kcal, whatever unit the label used.
 */
const OFF_NUTRIENT_IDS: Record<string, NutrientKey> = {
  proteins: "protein",
  carbohydrates: "carbs",
  fat: "fat",
  fiber: "fibre",
  sugars: "sugars",
  "saturated-fat": "saturatedFat",
  "vitamin-a": "vitaminA",
  "vitamin-b1": "thiamin",
  "vitamin-b2": "riboflavin",
  "vitamin-pp": "niacin",
  "pantothenic-acid": "pantothenicAcid",
  "vitamin-b6": "vitaminB6",
  biotin: "biotin",
  "vitamin-b9": "folate",
  "vitamin-b12": "vitaminB12",
  "vitamin-c": "vitaminC",
  "vitamin-d": "vitaminD",
  "vitamin-e": "vitaminE",
  "vitamin-k": "vitaminK",
  calcium: "calcium",
  iron: "iron",
  magnesium: "magnesium",
  potassium: "potassium",
  sodium: "sodium",
  zinc: "zinc",
  selenium: "selenium",
  copper: "copper",
  manganese: "manganese",
  phosphorus: "phosphorus",
  iodine: "iodine",
  chloride: "chloride",
  fluoride: "fluoride",
  chromium: "chromium",
  molybdenum: "molybdenum",
  choline: "choline",
};

/** A finite, non-negative number, or null. The API sometimes returns strings. */
function readNumber(value: unknown): Decimal | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Decimal(String(value).trim());
}

const clean = (s: string | undefined | null) => s?.replace(/\s+/g, " ").trim() || null;

/** "Ferrero, Nutella" -> "Ferrero" (the first listed brand). */
function firstBrand(brands: string | undefined): string | null {
  return clean(brands?.split(",")[0]);
}

/** Most specific category, skipping untranslated taxonomy tags such as "fr:Weetabix". */
function lastPlainCategory(categories: string | undefined): string | null {
  const plain = (categories ?? "")
    .split(",")
    .map((c) => clean(c))
    .filter((c): c is string => c !== null && !/^[a-z]{2,3}:/.test(c));
  return plain.at(-1)?.slice(0, 100) ?? null;
}

/**
 * Whether values and amounts are per 100 ml rather than per 100 g. Open Food
 * Facts often records "100g" even for drinks, so a product whose serving or
 * package is measured in millilitres is also treated as per 100 ml — which
 * is how liquid products are labelled.
 */
function amountUnitOf(p: OffProduct): "g" | "ml" {
  const isMl = (u: unknown) => typeof u === "string" && ["ml", "cl", "dl", "l"].includes(u.toLowerCase());
  if (p.nutrition_data_per === "100ml") return "ml";
  if (isMl(p.serving_quantity_unit) || isMl(p.product_quantity_unit)) return "ml";
  return "g";
}

/**
 * Map an Open Food Facts product to the app's normalised shape.
 *
 * Only declared per-100 values from `nutriments` are used. A nutrient that
 * is absent stays absent: nothing is defaulted to zero, and Open Food
 * Facts' ingredient-based estimates (`nutriments_estimated`) are ignored.
 * Returns null when the product has no usable name.
 */
export function normaliseOffProduct(product: OffProduct, barcode: string): NormalisedFood | null {
  const name = clean(product.product_name_en) ?? clean(product.product_name) ?? clean(product.generic_name_en) ?? clean(product.generic_name);
  if (!name) return null;

  const raw = product.nutriments ?? {};
  const nutrients: NormalisedFood["nutrients"] = {};

  // Energy: prefer the declared kcal value; otherwise convert the kJ value.
  const kcal = readNumber(raw["energy-kcal_100g"]);
  const kj = readNumber(raw["energy-kj_100g"]) ?? readNumber(raw["energy_100g"]);
  if (kcal) nutrients.energy = { amount: kcal.toDecimalPlaces(4).toString(), unit: "kcal" };
  else if (kj) nutrients.energy = { amount: convertAmount(kj, "kJ", "kcal").toDecimalPlaces(4).toString(), unit: "kcal" };

  for (const [offId, key] of Object.entries(OFF_NUTRIENT_IDS)) {
    const grams = readNumber(raw[`${offId}_100g`]);
    if (!grams) continue;
    const unit = NUTRIENTS[key].unit;
    nutrients[key] = { amount: convertAmount(grams, "g", unit).toDecimalPlaces(4).toString(), unit };
  }

  const amountUnit = amountUnitOf(product);
  const portions: NormalisedPortion[] = [];
  const serving = readNumber(product.serving_quantity);
  if (serving?.gt(0)) portions.push({ label: "1 serving", gramWeight: serving.toDecimalPlaces(3).toString() });
  const pack = readNumber(product.product_quantity);
  if (pack?.gt(0) && (!serving || !pack.eq(serving))) {
    portions.push({ label: "1 package", gramWeight: pack.toDecimalPlaces(3).toString() });
  }

  return {
    sourceId: openFoodFactsInfo.id,
    sourceFoodId: barcode,
    barcode,
    name: name.slice(0, 200),
    brand: firstBrand(product.brands)?.slice(0, 100) ?? null,
    category: lastPlainCategory(product.categories),
    imageUrl: /^https:\/\//.test(product.image_front_small_url ?? "")
      ? product.image_front_small_url!
      : /^https:\/\//.test(product.image_front_url ?? "")
        ? product.image_front_url!
        : null,
    ingredients: (clean(product.ingredients_text_en) ?? clean(product.ingredients_text))?.slice(0, 4000) ?? null,
    amountUnit,
    nutrients,
    portions,
  };
}
