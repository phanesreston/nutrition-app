import "server-only";
import type { Meal } from "@prisma/client";
import { db } from "@/lib/db";
import { dayToDate } from "@/lib/dates";
import { NUTRIENT_KEYS, isNutrientKey, type NutrientKey } from "@/domain/nutrients/catalog";
import { macroEnergySplit, summariseIntake, type Composition, type IntakeItem } from "@/domain/calc/intake";
import { scalePer100g } from "@/domain/calc/portion";
import { assessNutrient, type IntakeStatus } from "@/domain/calc/status";
import type { DataCoverage } from "@/domain/calc/intake";
import type { NutrientTarget, Targets } from "@/domain/reference/targets";
import { getTargets } from "./profile";

export const MEALS: readonly Meal[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
export const MEAL_LABELS: Record<Meal, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snacks",
};

export interface EntryView {
  id: string;
  meal: Meal;
  foodId: string;
  foodName: string;
  quantity: number;
  unitLabel: string;
  unitGrams: number;
  grams: number;
  /** Null when the food has no value for that nutrient. */
  energy: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface NutrientView {
  key: NutrientKey;
  consumed: number;
  target: NutrientTarget | null;
  /** consumed / target (1 = 100%). */
  fraction: number | null;
  remaining: number | null;
  status: IntakeStatus;
  coverage: DataCoverage;
  /** Logged foods with no value for this nutrient. */
  missingFrom: string[];
  upper: { evaluable: boolean; consumed: number | null; fraction: number | null } | null;
  /** Largest contributors first. */
  topContributors: { label: string; amount: number }[];
}

export interface DayView {
  date: string;
  entries: EntryView[];
  nutrients: Record<NutrientKey, NutrientView>;
  targets: Targets;
  mealEnergy: Record<Meal, number>;
  /** Share of energy from each macro (0–1), or null when nothing is logged. */
  energySplit: { protein: number; carbs: number; fat: number } | null;
}

export async function getDayView(userId: string, date: string): Promise<DayView> {
  const [rows, targets] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, date: dayToDate(date) },
      include: { food: { include: { nutrients: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getTargets(userId),
  ]);

  const items: IntakeItem[] = [];
  const entries: EntryView[] = [];
  const mealEnergy: Record<Meal, number> = { BREAKFAST: 0, LUNCH: 0, DINNER: 0, SNACK: 0 };

  for (const row of rows) {
    const per100g: Composition = {};
    for (const n of row.food.nutrients) {
      if (isNutrientKey(n.nutrientKey)) per100g[n.nutrientKey] = n.amount.toString();
    }
    const grams = row.grams.toString();
    items.push({ id: row.id, label: row.food.name, grams, per100g });

    const amount = (key: NutrientKey) => scalePer100g(per100g[key], grams)?.toNumber() ?? null;
    const energy = amount("energy");
    mealEnergy[row.meal] += energy ?? 0;
    entries.push({
      id: row.id,
      meal: row.meal,
      foodId: row.foodId,
      foodName: row.food.name,
      quantity: row.quantity.toNumber(),
      unitLabel: row.unitLabel,
      unitGrams: row.unitGrams.toNumber(),
      grams: row.grams.toNumber(),
      energy,
      protein: amount("protein"),
      carbs: amount("carbs"),
      fat: amount("fat"),
    });
  }

  const summary = summariseIntake(items);
  const nutrients = {} as Record<NutrientKey, NutrientView>;
  for (const key of NUTRIENT_KEYS) {
    const target = targets[key];
    const a = assessNutrient(key, summary, target);
    nutrients[key] = {
      key,
      consumed: a.consumed.toNumber(),
      target: target ?? null,
      fraction: a.fraction?.toNumber() ?? null,
      remaining: a.remaining?.toNumber() ?? null,
      status: a.status,
      coverage: a.coverage,
      missingFrom: summary[key].missing.map((m) => m.label),
      upper: a.upper && {
        evaluable: a.upper.evaluable,
        consumed: a.upper.consumed?.toNumber() ?? null,
        fraction: a.upper.fraction?.toNumber() ?? null,
      },
      topContributors: [...summary[key].contributions]
        .filter((c) => c.amount.gt(0))
        .sort((x, y) => y.amount.cmp(x.amount))
        .slice(0, 5)
        .map((c) => ({ label: c.label, amount: c.amount.toNumber() })),
    };
  }

  const split = macroEnergySplit({
    protein: summary.protein.total,
    carbs: summary.carbs.total,
    fat: summary.fat.total,
  });

  return {
    date,
    entries,
    nutrients,
    targets,
    mealEnergy,
    energySplit: split && { protein: split.protein.toNumber(), carbs: split.carbs.toNumber(), fat: split.fat.toNumber() },
  };
}
