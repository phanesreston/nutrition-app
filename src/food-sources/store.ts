/**
 * The single place that writes a food's effective values. Every path that
 * changes a food — bulk imports, barcode refreshes, custom foods and admin
 * edits — stores its input (the imported record or an override) and then
 * calls `materialiseFood`, which recomputes "imported record + overrides"
 * and writes the result. Nothing else writes nutrients or portions, so an
 * import can never overwrite an administrator's correction.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { isNutrientKey } from "@/domain/nutrients/catalog";
import { mergeFood, type Override } from "./merge";
import type { NormalisedFood } from "./types";

export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The imported record for a food. Rows created before `sourceData` existed
 * have none; their current values ARE the imported values (nothing could
 * have edited them), so the record is rebuilt from the row.
 */
export async function loadSource(db: Db, foodId: string): Promise<NormalisedFood> {
  const row = await db.food.findUniqueOrThrow({ where: { id: foodId }, include: { nutrients: true, portions: { orderBy: { sortOrder: "asc" } } } });
  if (row.sourceData) return row.sourceData as unknown as NormalisedFood;

  const nutrients: NormalisedFood["nutrients"] = {};
  for (const n of row.nutrients) {
    if (isNutrientKey(n.nutrientKey)) nutrients[n.nutrientKey] = { amount: n.amount.toString(), unit: n.unit as never };
  }
  return {
    sourceId: row.sourceId,
    sourceFoodId: row.sourceFoodId,
    name: row.name,
    category: row.category,
    barcode: row.barcode,
    brand: row.brand,
    imageUrl: row.imageUrl,
    ingredients: row.ingredients,
    description: row.description,
    amountUnit: row.amountUnit === "ml" ? "ml" : "g",
    nutrients,
    portions: row.portions.map((p) => ({ label: p.label, gramWeight: p.gramWeight.toString() })),
  };
}

export async function loadOverrides(db: Db, foodId: string): Promise<Override[]> {
  const rows = await db.foodOverride.findMany({ where: { foodId } });
  return rows.map((r) => ({ field: r.field, value: r.value, estimated: r.estimated }));
}

/**
 * Recompute a food's effective values from its imported record and its
 * overrides, and write them. Also pins the imported record into
 * `sourceData` the first time, so it is retained from then on.
 */
export async function materialiseFood(db: Db, foodId: string): Promise<void> {
  const source = await loadSource(db, foodId);
  const overrides = await loadOverrides(db, foodId);
  const { food, nutrientOrigins } = mergeFood(source, overrides);

  await db.food.update({
    where: { id: foodId },
    data: {
      sourceData: source as unknown as Prisma.InputJsonValue,
      name: food.name,
      category: food.category ?? null,
      barcode: food.barcode ?? null,
      brand: food.brand ?? null,
      imageUrl: food.imageUrl ?? null,
      ingredients: food.ingredients ?? null,
      description: food.description ?? null,
      amountUnit: food.amountUnit ?? "g",
    },
  });
  await db.foodNutrient.deleteMany({ where: { foodId } });
  await db.foodPortion.deleteMany({ where: { foodId } });
  await db.foodNutrient.createMany({
    data: Object.entries(food.nutrients).map(([nutrientKey, v]) => ({
      foodId,
      nutrientKey,
      amount: v.amount,
      unit: v.unit,
      origin: nutrientOrigins[nutrientKey as keyof typeof nutrientOrigins] ?? "reference",
    })),
  });
  await db.foodPortion.createMany({
    data: food.portions.map((p, i) => ({ foodId, label: p.label, gramWeight: p.gramWeight, sortOrder: i })),
  });
}

/**
 * Store a freshly imported record for a food (creating the food if needed)
 * and recompute its effective values. Returns the food id.
 */
export async function saveImportedFood(
  db: Db,
  food: NormalisedFood,
  extra: { fetchedAt?: Date; createdByUserId?: string; foodId?: string } = {},
): Promise<string> {
  const sourceData = food as unknown as Prisma.InputJsonValue;
  const { foodId, ...columns } = extra;
  const row = foodId
    ? await db.food.update({ where: { id: foodId }, data: { sourceData, ...columns } })
    : await db.food.upsert({
        where: { sourceId_sourceFoodId: { sourceId: food.sourceId, sourceFoodId: food.sourceFoodId } },
        update: { sourceData, ...columns },
        create: { sourceId: food.sourceId, sourceFoodId: food.sourceFoodId, name: food.name, sourceData, ...columns },
      });
  await materialiseFood(db, row.id);
  return row.id;
}
