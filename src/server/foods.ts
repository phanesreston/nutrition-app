import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CORE_KEYS, isNutrientKey, type NutrientKey } from "@/domain/nutrients/catalog";

const foodInclude = {
  nutrients: true,
  portions: { orderBy: { sortOrder: "asc" } },
  source: true,
} satisfies Prisma.FoodInclude;

type FoodRow = Prisma.FoodGetPayload<{ include: typeof foodInclude }>;

/** A food as sent to the browser: plain JSON, decimals as numbers. */
export interface FoodView {
  id: string;
  name: string;
  category: string | null;
  source: { id: string; name: string; version: string; license: string; url: string };
  sourceFoodId: string;
  /** Per 100 g. A key that is absent is unknown — not zero. */
  per100g: Partial<Record<NutrientKey, number>>;
  portions: { id: string; label: string; gramWeight: number }[];
  /** How many of the core nutrients (macros + vitamins + minerals) have a value. */
  completeness: { known: number; total: number; missing: NutrientKey[] };
}

export function toFoodView(row: FoodRow): FoodView {
  const per100g: FoodView["per100g"] = {};
  for (const n of row.nutrients) {
    if (isNutrientKey(n.nutrientKey)) per100g[n.nutrientKey] = n.amount.toNumber();
  }
  const missing = CORE_KEYS.filter((k) => per100g[k] === undefined);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    source: {
      id: row.source.id,
      name: row.source.name,
      version: row.source.version,
      license: row.source.license,
      url: row.source.url,
    },
    sourceFoodId: row.sourceFoodId,
    per100g,
    portions: row.portions.map((p) => ({ id: p.id, label: p.label, gramWeight: p.gramWeight.toNumber() })),
    completeness: { known: CORE_KEYS.length - missing.length, total: CORE_KEYS.length, missing },
  };
}

/** Rank: name starts with the query, then a word starts with it, then shorter names. */
function rank(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n.startsWith(q)) return 0;
  if (new RegExp(`(^|[\\s,(])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n)) return 1;
  return 2;
}

/**
 * Search foods by name. Every whitespace-separated term must appear in the
 * name (case-insensitive), in any order. An empty query lists foods A–Z.
 */
export async function searchFoods(query: string, limit = 30): Promise<FoodView[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const rows = await db.food.findMany({
    where: { AND: terms.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) },
    include: foodInclude,
    orderBy: { name: "asc" },
    take: terms.length ? 200 : limit,
  });
  const q = terms.join(" ");
  if (terms.length) {
    rows.sort((a, b) => rank(a.name, q) - rank(b.name, q) || a.name.length - b.name.length || a.name.localeCompare(b.name));
  }
  return rows.slice(0, limit).map(toFoodView);
}

export async function getFood(id: string): Promise<FoodView | null> {
  const row = await db.food.findUnique({ where: { id }, include: foodInclude });
  return row ? toFoodView(row) : null;
}

export async function countFoods(): Promise<number> {
  return db.food.count();
}

export async function listFoodSources() {
  return db.foodSource.findMany({ include: { _count: { select: { foods: true } } } });
}

export async function getFoodsByIds(ids: string[]): Promise<Map<string, FoodView>> {
  if (ids.length === 0) return new Map();
  const rows = await db.food.findMany({ where: { id: { in: ids } }, include: foodInclude });
  return new Map(rows.map((r) => [r.id, toFoodView(r)]));
}
