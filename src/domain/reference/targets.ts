import { MICRO_KEYS, type NutrientKey } from "../nutrients/catalog";
import {
  EFSA_MACROS,
  EU_LABEL_REFERENCE,
  efsaMicronutrientReference,
  type ReferenceKind,
  type UpperLevel,
} from "./efsa";
import type { ActivityLevel, Goal, PersonProfile } from "./profile";

/** Where a target came from — shown to the user so the kinds are never conflated. */
export type TargetOrigin =
  | ReferenceKind
  /** Estimated from the profile with a documented formula (not an EFSA value). */
  | "estimate"
  /** Derived from EFSA reference ranges and the energy target. */
  | "derived"
  /** Generic EU labelling reference intake, used when the profile is incomplete. */
  | "generic"
  /** Set explicitly by the user. */
  | "user";

/**
 * - `minimum`: aim to reach it (most nutrients).
 * - `limit`:   aim to stay at or below it (sodium).
 * - `budget`:  aim to land near it (energy).
 */
export type TargetDirection = "minimum" | "limit" | "budget";

export interface NutrientTarget {
  amount: number;
  origin: TargetOrigin;
  direction: TargetDirection;
  upper?: UpperLevel;
  note?: string;
}

export type Targets = Partial<Record<NutrientKey, NutrientTarget>>;

/** Conventional physical-activity multipliers applied to resting energy expenditure. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** Daily energy adjustment for the chosen goal (kcal). A common heuristic, not an EFSA value. */
export const GOAL_ADJUSTMENT_KCAL: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };

/**
 * Resting energy expenditure by the Mifflin–St Jeor equation (kcal/day).
 * Returns null when any input is missing. With sex unspecified, the mean of
 * the male and female constants is used.
 */
export function restingEnergyKcal(p: PersonProfile): number | null {
  if (!p.weightKg || !p.heightCm || !p.ageYears) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears;
  const constant = p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78;
  return base + constant;
}

export function estimatedEnergyKcal(p: PersonProfile): number | null {
  const resting = restingEnergyKcal(p);
  if (resting === null) return null;
  const total = resting * ACTIVITY_FACTORS[p.activityLevel ?? "light"] + GOAL_ADJUSTMENT_KCAL[p.goal ?? "maintain"];
  // Never suggest very low energy targets automatically.
  return Math.max(1200, Math.round(total / 10) * 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeTargets(profile: PersonProfile): Targets {
  const custom = profile.custom ?? {};
  const targets: Targets = {};

  // Energy
  const estimate = estimatedEnergyKcal(profile);
  if (custom.energyKcal) {
    targets.energy = { amount: custom.energyKcal, origin: "user", direction: "budget" };
  } else if (estimate !== null) {
    targets.energy = {
      amount: estimate,
      origin: "estimate",
      direction: "budget",
      note: "Estimated with the Mifflin–St Jeor equation, your activity level and goal.",
    };
  } else {
    targets.energy = {
      amount: EU_LABEL_REFERENCE.energyKcal,
      origin: "generic",
      direction: "budget",
      note: "Generic EU reference intake for an average adult. Complete your profile for a personal estimate.",
    };
  }
  const energyKcal = targets.energy.amount;

  // Protein
  if (custom.proteinG) {
    targets.protein = { amount: custom.proteinG, origin: "user", direction: "minimum" };
  } else if (profile.weightKg) {
    targets.protein = {
      amount: round1(EFSA_MACROS.proteinGPerKg * profile.weightKg),
      origin: "PRI",
      direction: "minimum",
      note: `${EFSA_MACROS.proteinGPerKg} g per kg body weight.`,
    };
  } else {
    targets.protein = {
      amount: EU_LABEL_REFERENCE.proteinG,
      origin: "generic",
      direction: "minimum",
      note: "Generic EU reference intake. Add your weight for a personal value.",
    };
  }

  // Fat: 30% of energy sits inside EFSA's 20–35% reference range.
  const fatPercent = 30;
  targets.fat = custom.fatG
    ? { amount: custom.fatG, origin: "user", direction: "budget" }
    : {
        amount: round1((energyKcal * fatPercent) / 100 / 9),
        origin: "derived",
        direction: "budget",
        note: `${fatPercent}% of your energy target (EFSA reference range ${EFSA_MACROS.fatEnergyPercent.min}–${EFSA_MACROS.fatEnergyPercent.max}%).`,
      };

  // Carbohydrate: 50% of energy sits inside EFSA's 45–60% range.
  const carbPercent = 50;
  targets.carbs = custom.carbsG
    ? { amount: custom.carbsG, origin: "user", direction: "budget" }
    : {
        amount: round1((energyKcal * carbPercent) / 100 / 4),
        origin: "derived",
        direction: "budget",
        note: `${carbPercent}% of your energy target (EFSA reference range ${EFSA_MACROS.carbEnergyPercent.min}–${EFSA_MACROS.carbEnergyPercent.max}%).`,
      };

  targets.fibre = custom.fibreG
    ? { amount: custom.fibreG, origin: "user", direction: "minimum" }
    : { amount: EFSA_MACROS.fibreG, origin: "AI", direction: "minimum" };

  // Micronutrients
  for (const key of MICRO_KEYS) {
    const ref = efsaMicronutrientReference(key as Parameters<typeof efsaMicronutrientReference>[0], {
      sex: profile.sex,
      ageYears: profile.ageYears,
      energyKcal,
    });
    targets[key] = {
      amount: ref.amount,
      origin: ref.kind,
      direction: ref.kind === "safe-and-adequate" ? "limit" : "minimum",
      upper: ref.upper,
      note: ref.basisNote,
    };
  }

  return targets;
}

export const ORIGIN_LABELS: Record<TargetOrigin, { short: string; long: string }> = {
  PRI: { short: "PRI", long: "EFSA Population Reference Intake — covers the needs of nearly all healthy people" },
  AI: { short: "AI", long: "EFSA Adequate Intake — used where a PRI cannot be established" },
  "safe-and-adequate": { short: "Safe & adequate", long: "EFSA safe and adequate intake — aim to stay at or below" },
  estimate: { short: "Estimate", long: "Estimated from your profile; not an official reference value" },
  derived: { short: "Derived", long: "Derived from EFSA reference ranges and your energy target" },
  generic: { short: "Generic", long: "Generic EU reference intake for an average adult" },
  user: { short: "Your goal", long: "A goal you set yourself" },
};
