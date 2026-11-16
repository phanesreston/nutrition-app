import type { PrismaClient } from "@prisma/client";
import { saveImportedFood } from "./store";
import type { FoodSourceInfo, NormalisedFood } from "./types";

/**
 * Idempotently load normalised foods into the database. Re-running replaces
 * each food's imported record but keeps its id (so diary entries stay
 * valid) and keeps any administrator corrections, which are re-applied on
 * top of the new data.
 */
export async function importFoods(
  prisma: PrismaClient,
  source: FoodSourceInfo,
  foods: readonly NormalisedFood[],
  /** Extra columns set on every imported food, e.g. `{ fetchedAt }` for cached remote records. */
  extra: { fetchedAt?: Date } = {},
): Promise<number> {
  await prisma.foodSource.upsert({ where: { id: source.id }, update: source, create: source });
  for (const food of foods) {
    await prisma.$transaction((tx) => saveImportedFood(tx, food, extra));
  }
  return foods.length;
}
