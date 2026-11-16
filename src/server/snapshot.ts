import type { Prisma } from "@prisma/client";
import type { Db } from "@/food-sources/store";

/**
 * The food's per-100 nutrient values right now, as stored on a diary entry
 * when it is logged. Decimal strings keyed by nutrient; a nutrient with no
 * value is simply absent.
 */
export async function snapshotNutrients(db: Db, foodId: string): Promise<Prisma.InputJsonObject> {
  const rows = await db.foodNutrient.findMany({ where: { foodId } });
  return Object.fromEntries(rows.map((n) => [n.nutrientKey, n.amount.toString()]));
}
