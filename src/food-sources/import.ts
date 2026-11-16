import type { PrismaClient } from "@prisma/client";
import type { FoodSourceInfo, NormalisedFood } from "./types";

/**
 * Idempotently load normalised foods into the database. Re-running replaces
 * each food's nutrients and portions but keeps its id, so diary entries that
 * reference it stay valid.
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
    const nutrients = Object.entries(food.nutrients).map(([nutrientKey, v]) => ({
      nutrientKey,
      amount: v.amount,
      unit: v.unit,
    }));
    const portions = food.portions.map((p, i) => ({ label: p.label, gramWeight: p.gramWeight, sortOrder: i }));
    const where = { sourceId_sourceFoodId: { sourceId: source.id, sourceFoodId: food.sourceFoodId } };

    await prisma.$transaction(async (tx) => {
      const fields = {
        name: food.name,
        category: food.category,
        barcode: food.barcode ?? null,
        brand: food.brand ?? null,
        imageUrl: food.imageUrl ?? null,
        ingredients: food.ingredients ?? null,
        amountUnit: food.amountUnit ?? "g",
        ...extra,
      };
      const row = await tx.food.upsert({
        where,
        update: fields,
        create: { sourceId: source.id, sourceFoodId: food.sourceFoodId, ...fields },
      });
      await tx.foodNutrient.deleteMany({ where: { foodId: row.id } });
      await tx.foodPortion.deleteMany({ where: { foodId: row.id } });
      await tx.foodNutrient.createMany({ data: nutrients.map((n) => ({ ...n, foodId: row.id })) });
      await tx.foodPortion.createMany({ data: portions.map((p) => ({ ...p, foodId: row.id })) });
    });
  }
  return foods.length;
}
