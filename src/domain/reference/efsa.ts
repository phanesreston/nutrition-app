/**
 * Dietary Reference Values (DRVs) for healthy ADULTS (18+) from the European
 * Food Safety Authority (EFSA).
 *
 * Source: EFSA "Dietary Reference Values for nutrients — Summary report"
 * (2017, updated) and the individual scientific opinions, including the
 * revised tolerable upper intake levels for vitamin B6 (2023), selenium
 * (2023), manganese (2023), iron (2024) and vitamin E (2024).
 * Interactive lookup: https://multimedia.efsa.europa.eu/drvs/index.htm
 *
 * These figures were transcribed by hand, not machine-imported. See
 * docs/reference-values.md for the full table and its limitations.
 * Not covered: children and adolescents, pregnancy, lactation.
 *
 * Terminology (EFSA):
 *  - PRI  Population Reference Intake: covers the needs of ~97.5% of people.
 *  - AI   Adequate Intake: used when a PRI cannot be established.
 *  - UL   Tolerable Upper Intake Level: maximum chronic daily intake unlikely
 *         to pose a risk of adverse effects.
 *  - Safe level of intake: given where data are insufficient for a UL.
 */
import type { NutrientKey } from "../nutrients/catalog";
import type { Sex } from "./profile";

export type ReferenceKind =
  /** Population Reference Intake. */
  | "PRI"
  /** Adequate Intake. */
  | "AI"
  /** EFSA "safe and adequate intake" (sodium): a level to stay around or below. */
  | "safe-and-adequate";

export type UpperKind = "UL" | "safe-level";

/** What the upper level is evaluated against. */
export type UpperBasis =
  /** Total intake of the nutrient from food. */
  | "total"
  /** Only a specific form, tracked as a separate nutrient (e.g. retinol). */
  | { nutrient: NutrientKey; label: string }
  /** Only supplemental / added forms, which a food log does not capture. */
  | "supplemental-only";

export interface UpperLevel {
  amount: number;
  kind: UpperKind;
  basis: UpperBasis;
}

export interface MicronutrientReference {
  amount: number;
  kind: ReferenceKind;
  upper?: UpperLevel;
  /** Explains which assumption produced this value, when one was needed. */
  basisNote?: string;
}

export interface ReferenceContext {
  sex?: Sex | null;
  ageYears?: number | null;
  /** Daily energy target, used for nutrients set relative to energy. */
  energyKcal: number;
}

const KJ_PER_KCAL = 4.184;

/** Pick the sex-specific value; with sex unspecified use the higher, so targets err on the side of sufficiency. */
function bySex(sex: Sex | null | undefined, male: number, female: number): { amount: number; note?: string } {
  if (sex === "male") return { amount: male };
  if (sex === "female") return { amount: female };
  return { amount: Math.max(male, female), note: "Sex not specified — using the higher of the male and female values." };
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

type MicroKey = Exclude<
  NutrientKey,
  | "energy"
  | "protein"
  | "carbs"
  | "fat"
  | "fibre"
  | "sugars"
  | "saturatedFat"
  | "retinol"
  | "folicAcid"
  | "chloride"
  | "fluoride"
  | "chromium"
  | "molybdenum"
  | "choline"
>;

export function efsaMicronutrientReference(key: MicroKey, ctx: ReferenceContext): MicronutrientReference {
  const { sex, ageYears } = ctx;
  const megajoules = (ctx.energyKcal * KJ_PER_KCAL) / 1000;

  switch (key) {
    case "vitaminA": {
      const v = bySex(sex, 750, 650);
      return {
        amount: v.amount,
        kind: "PRI",
        basisNote: v.note,
        upper: { amount: 3000, kind: "UL", basis: { nutrient: "retinol", label: "preformed vitamin A (retinol)" } },
      };
    }
    case "thiamin":
      return {
        amount: round(0.1 * megajoules, 2),
        kind: "PRI",
        basisNote: "0.1 mg per MJ of your energy target.",
      };
    case "riboflavin":
      return { amount: 1.6, kind: "PRI" };
    case "niacin":
      return {
        amount: round(1.6 * megajoules, 1),
        kind: "PRI",
        basisNote: "1.6 mg niacin equivalents per MJ of your energy target.",
        upper: { amount: 10, kind: "UL", basis: "supplemental-only" },
      };
    case "pantothenicAcid":
      return { amount: 5, kind: "AI" };
    case "vitaminB6": {
      const v = bySex(sex, 1.7, 1.6);
      return { amount: v.amount, kind: "PRI", basisNote: v.note, upper: { amount: 12, kind: "UL", basis: "total" } };
    }
    case "biotin":
      return { amount: 40, kind: "AI" };
    case "folate":
      return {
        amount: 330,
        kind: "PRI",
        upper: { amount: 1000, kind: "UL", basis: { nutrient: "folicAcid", label: "synthetic folic acid" } },
      };
    case "vitaminB12":
      return { amount: 4, kind: "AI" };
    case "vitaminC": {
      const v = bySex(sex, 110, 95);
      return { amount: v.amount, kind: "PRI", basisNote: v.note };
    }
    case "vitaminD":
      return { amount: 15, kind: "AI", upper: { amount: 100, kind: "UL", basis: "total" } };
    case "vitaminE": {
      const v = bySex(sex, 13, 11);
      return { amount: v.amount, kind: "AI", basisNote: v.note, upper: { amount: 300, kind: "UL", basis: "total" } };
    }
    case "vitaminK":
      return { amount: 70, kind: "AI" };
    case "calcium": {
      const young = ageYears !== null && ageYears !== undefined && ageYears < 25;
      return {
        amount: young ? 1000 : 950,
        kind: "PRI",
        basisNote: young ? "Adults aged 18–24." : "Adults aged 25 and over.",
        upper: { amount: 2500, kind: "UL", basis: "total" },
      };
    }
    case "iron": {
      const upper: UpperLevel = { amount: 40, kind: "safe-level", basis: "total" };
      if (sex === "male") return { amount: 11, kind: "PRI", upper };
      const postmenopausal = ageYears !== null && ageYears !== undefined && ageYears >= 51;
      if (sex === "female" && postmenopausal) {
        return { amount: 11, kind: "PRI", basisNote: "Value for postmenopausal women (assumed from age 51).", upper };
      }
      return {
        amount: 16,
        kind: "PRI",
        basisNote:
          sex === "female"
            ? "Value for premenopausal women (assumed under age 51)."
            : "Sex not specified — using the higher value, for premenopausal women.",
        upper,
      };
    }
    case "magnesium": {
      const v = bySex(sex, 350, 300);
      return {
        amount: v.amount,
        kind: "AI",
        basisNote: v.note,
        upper: { amount: 250, kind: "UL", basis: "supplemental-only" },
      };
    }
    case "potassium":
      return { amount: 3500, kind: "AI" };
    case "sodium":
      return { amount: 2000, kind: "safe-and-adequate" };
    case "zinc": {
      // PRI at a phytate intake of 600 mg/day (EFSA gives 300/600/900/1200).
      const v = bySex(sex, 11.7, 9.3);
      return {
        amount: v.amount,
        kind: "PRI",
        basisNote: ["Assumes a phytate intake of 600 mg/day.", v.note].filter(Boolean).join(" "),
        upper: { amount: 25, kind: "UL", basis: "total" },
      };
    }
    case "selenium":
      return { amount: 70, kind: "AI", upper: { amount: 255, kind: "UL", basis: "total" } };
    case "copper": {
      const v = bySex(sex, 1.6, 1.3);
      return { amount: v.amount, kind: "AI", basisNote: v.note, upper: { amount: 5, kind: "UL", basis: "total" } };
    }
    case "manganese":
      return { amount: 3, kind: "AI", upper: { amount: 8, kind: "safe-level", basis: "total" } };
    case "phosphorus":
      return { amount: 550, kind: "AI" };
    case "iodine":
      return { amount: 150, kind: "AI", upper: { amount: 600, kind: "UL", basis: "total" } };
  }
}

/** EFSA macronutrient references for adults. */
export const EFSA_MACROS = {
  /** PRI for protein, g per kg body weight per day. */
  proteinGPerKg: 0.83,
  /** Reference intake range for total fat, % of energy. */
  fatEnergyPercent: { min: 20, max: 35 },
  /** Reference intake range for total carbohydrate, % of energy. */
  carbEnergyPercent: { min: 45, max: 60 },
  /** AI for dietary fibre, g per day. */
  fibreG: 25,
} as const;

/**
 * EU labelling reference intakes for an average adult (Regulation (EU)
 * No 1169/2011, Annex XIII). Used only as a fallback when the profile lacks
 * the height/weight/age needed for a personal estimate.
 */
export const EU_LABEL_REFERENCE = { energyKcal: 2000, proteinG: 50 } as const;
