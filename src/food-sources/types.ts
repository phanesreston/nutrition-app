import type { NutrientKey, Unit } from "@/domain/nutrients/catalog";

/** Metadata describing a food composition database. */
export interface FoodSourceInfo {
  /** Stable slug, e.g. "usda-sr-legacy". */
  id: string;
  name: string;
  version: string;
  publisher: string;
  license: string;
  url: string;
}

export interface NormalisedPortion {
  label: string;
  gramWeight: string;
}

/**
 * A food in the app's source-independent shape. Every integration (USDA,
 * CoFID, …) maps its native records to this, so the rest of the app never
 * sees source-specific formats.
 *
 * Amounts are decimal strings per 100 g of edible portion, in the catalogue's
 * canonical unit for that nutrient. A nutrient the source does not report is
 * simply absent — never zero.
 */
export interface NormalisedFood {
  sourceId: string;
  sourceFoodId: string;
  name: string;
  category: string | null;
  /** Canonical GTIN, for packaged products. */
  barcode?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  ingredients?: string | null;
  description?: string | null;
  /** Unit the values are per 100 of. Defaults to grams. */
  amountUnit?: "g" | "ml";
  nutrients: Partial<Record<NutrientKey, { amount: string; unit: Unit }>>;
  portions: NormalisedPortion[];
}

/** Contract for a food composition source that can be bulk-imported. */
export interface FoodSourceAdapter<Raw> {
  info: FoodSourceInfo;
  /** Map one native record to the normalised shape, or null to skip it. */
  normalise(raw: Raw): NormalisedFood | null;
}
