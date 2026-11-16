import "server-only";
import { db } from "@/lib/db";
import { parseBarcode } from "@/domain/barcode";
import { importFoods } from "@/food-sources/import";
import { RateLimiter, configuredUserAgent, fetchOffProduct, type OffFailure } from "@/food-sources/open-food-facts/client";
import { normaliseOffProduct, openFoodFactsInfo } from "@/food-sources/open-food-facts/mapper";
import { foodInclude, toFoodView, type FoodView } from "./foods";

export type BarcodeLookup =
  | {
      status: "found";
      barcode: string;
      food: FoodView;
      /** Where the record came from on this request. */
      origin: "custom" | "cache" | "open-food-facts";
      /** True when a refresh failed and an older cached copy is shown. */
      stale: boolean;
    }
  | { status: "invalid" }
  | { status: "not-found"; barcode: string }
  | { status: "error"; barcode: string; reason: OffFailure };

/** Cached products are refreshed after this long. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** How long an "unknown product" answer is remembered, to avoid re-asking on every rescan. */
const NOT_FOUND_TTL_MS = 10 * 60 * 1000;

// Open Food Facts allows 100 product reads per minute; stay well inside it.
const limiter = new RateLimiter(40, 60_000);
const notFound = new Map<string, number>();

function rememberNotFound(barcode: string) {
  if (notFound.size > 500) notFound.clear();
  notFound.set(barcode, Date.now() + NOT_FOUND_TTL_MS);
}

/** Forget a remembered "unknown product", e.g. once a custom food is created for it. */
export function forgetNotFound(barcode: string) {
  notFound.delete(barcode);
}

/**
 * Resolve a barcode to a food: the user's own custom food first, then the
 * local cache of Open Food Facts products, then the Open Food Facts API
 * (whose answer is saved so the next scan is local).
 */
export async function lookupBarcode(userId: string, input: string, format?: string): Promise<BarcodeLookup> {
  const parsed = parseBarcode(input, { format });
  if (!parsed) return { status: "invalid" };
  const barcode = parsed.code;

  const local = await db.food.findMany({
    where: { barcode, OR: [{ createdByUserId: userId }, { createdByUserId: null }] },
    include: foodInclude,
  });
  const custom = local.find((f) => f.createdByUserId === userId);
  if (custom) return { status: "found", barcode, food: toFoodView(custom), origin: "custom", stale: false };

  const cached = local.find((f) => f.sourceId === openFoodFactsInfo.id);
  const fresh = cached?.fetchedAt && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;
  if (cached && fresh) return { status: "found", barcode, food: toFoodView(cached), origin: "cache", stale: false };

  const staleResult = (): BarcodeLookup | null =>
    cached ? { status: "found", barcode, food: toFoodView(cached), origin: "cache", stale: true } : null;

  if ((notFound.get(barcode) ?? 0) > Date.now()) return { status: "not-found", barcode };
  if (!limiter.tryAcquire()) return staleResult() ?? { status: "error", barcode, reason: "rate-limited" };

  const result = await fetchOffProduct(barcode, { userAgent: configuredUserAgent() });

  if (result.status === "error") {
    if (result.reason === "rate-limited") limiter.coolDown(60_000);
    return staleResult() ?? { status: "error", barcode, reason: result.reason };
  }

  const food = result.status === "found" ? normaliseOffProduct(result.product, barcode) : null;
  if (!food) {
    // Unknown to Open Food Facts, or listed without even a name.
    rememberNotFound(barcode);
    return staleResult() ?? { status: "not-found", barcode };
  }

  await importFoods(db, openFoodFactsInfo, [food], { fetchedAt: new Date() });
  const saved = await db.food.findUniqueOrThrow({
    where: { sourceId_sourceFoodId: { sourceId: openFoodFactsInfo.id, sourceFoodId: barcode } },
    include: foodInclude,
  });
  return { status: "found", barcode, food: toFoodView(saved), origin: "open-food-facts", stale: false };
}
