import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/products.json";
import { RateLimiter, configuredUserAgent, fetchOffProduct, type OffProduct } from "./client";
import { normaliseOffProduct } from "./mapper";

// Fixtures are trimmed copies of real API v3 responses (data © Open Food Facts contributors, ODbL).
const product = (name: keyof typeof fixtures) => fixtures[name].product as OffProduct;

describe("normaliseOffProduct", () => {
  it("converts gram-normalised micronutrients to catalogue units", () => {
    const food = normaliseOffProduct(product("weetabix"), "5010029000023")!;
    expect(food.sourceId).toBe("open-food-facts");
    expect(food.sourceFoodId).toBe("5010029000023");
    expect(food.barcode).toBe("5010029000023");
    expect(food.brand).toBe("Weetabix");
    expect(food.nutrients.energy).toEqual({ amount: "362", unit: "kcal" });
    expect(food.nutrients.iron).toEqual({ amount: "12", unit: "mg" }); // 0.012 g
    expect(food.nutrients.thiamin).toEqual({ amount: "0.94", unit: "mg" });
    expect(food.nutrients.folate).toEqual({ amount: "170", unit: "µg" }); // 0.00017 g
    expect(food.nutrients.niacin).toEqual({ amount: "14", unit: "mg" });
    expect(food.nutrients.vitaminB6).toEqual({ amount: "2.4267", unit: "mg" }); // float noise rounded
    expect(food.nutrients.sodium).toEqual({ amount: "104", unit: "mg" });
  });

  it("leaves undeclared nutrients missing and ignores ingredient-based estimates", () => {
    const food = normaliseOffProduct(product("weetabix"), "5010029000023")!;
    expect(food.nutrients.vitaminC).toBeUndefined();
    expect(food.nutrients.calcium).toBeUndefined();
    expect(food.nutrients.vitaminB12).toBeUndefined();
    // The fixture carries nutriments_estimated.iron_100g = 0.999; the declared 0.012 must win.
    expect(food.nutrients.iron?.amount).toBe("12");
  });

  it("keeps declared zeros as zeros", () => {
    const food = normaliseOffProduct(product("nutella"), "3017620422003")!;
    expect(food.nutrients.fibre).toEqual({ amount: "0", unit: "g" });
    expect(food.nutrients.iron).toBeUndefined();
  });

  it("handles tiny values in scientific notation", () => {
    const food = normaliseOffProduct(product("oatly"), "7394376616228")!;
    expect(food.nutrients.vitaminB12).toEqual({ amount: "0.24", unit: "µg" }); // 2.4e-7 g
    expect(food.nutrients.vitaminD).toEqual({ amount: "1.1", unit: "µg" });
    expect(food.nutrients.iodine).toEqual({ amount: "22.5", unit: "µg" });
    expect(food.nutrients.calcium).toEqual({ amount: "120", unit: "mg" });
  });

  it("treats drinks as per 100 ml and builds serving and package portions", () => {
    const redBull = normaliseOffProduct(product("redBull"), "9002490100070")!;
    expect(redBull.amountUnit).toBe("ml");
    // Serving and package are both 250 ml: one portion, not two.
    expect(redBull.portions).toEqual([{ label: "1 serving", gramWeight: "250" }]);

    const oatly = normaliseOffProduct(product("oatly"), "7394376616228")!;
    expect(oatly.amountUnit).toBe("ml"); // recorded as "100g" upstream, but sold and served in ml
    expect(oatly.portions).toEqual([
      { label: "1 serving", gramWeight: "100" },
      { label: "1 package", gramWeight: "1000" },
    ]);

    const weetabix = normaliseOffProduct(product("weetabix"), "5010029000023")!;
    expect(weetabix.amountUnit).toBe("g");
    expect(weetabix.portions[0]).toEqual({ label: "1 serving", gramWeight: "37.5" });
  });

  it("falls back to kJ when kcal is not declared", () => {
    const food = normaliseOffProduct({ product_name: "X", nutriments: { "energy-kj_100g": 418.4 } }, "50184453")!;
    expect(food.nutrients.energy).toEqual({ amount: "100", unit: "kcal" });
  });

  it("rejects negative, empty and non-numeric values", () => {
    const food = normaliseOffProduct(
      { product_name: "X", nutriments: { proteins_100g: -1, fat_100g: "", sugars_100g: "abc", carbohydrates_100g: "12.5" } },
      "50184453",
    )!;
    expect(food.nutrients.protein).toBeUndefined();
    expect(food.nutrients.fat).toBeUndefined();
    expect(food.nutrients.sugars).toBeUndefined();
    expect(food.nutrients.carbs).toEqual({ amount: "12.5", unit: "g" });
  });

  it("returns a product with no nutrition data as a food with no nutrients", () => {
    const food = normaliseOffProduct({ product_name: "Mystery" }, "50184453")!;
    expect(food.nutrients).toEqual({});
  });

  it("skips untranslated taxonomy tags when choosing a category", () => {
    const tagged = normaliseOffProduct({ product_name: "X", categories: "Breakfasts, Cereals, fr:Weetabix" }, "50184453")!;
    expect(tagged.category).toBe("Cereals");
    expect(normaliseOffProduct({ product_name: "X" }, "50184453")!.category).toBeNull();
  });

  it("returns null without a name, and only accepts https images", () => {
    expect(normaliseOffProduct({ nutriments: {} }, "50184453")).toBeNull();
    const food = normaliseOffProduct({ product_name: "X", image_front_small_url: "javascript:alert(1)" }, "50184453")!;
    expect(food.imageUrl).toBeNull();
  });
});

describe("fetchOffProduct", () => {
  const options = (fetchImpl: typeof fetch) => ({ userAgent: "Test/1.0 (test)", fetchImpl, timeoutMs: 50 });
  const json = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("sends the identifying User-Agent and requests only the needed fields", async () => {
    let seen: { url: string; ua: string | null } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, ua: new Headers(init.headers).get("User-Agent") };
      return new Response(JSON.stringify(fixtures.nutella), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await fetchOffProduct("3017620422003", options(fetchImpl));
    expect(result.status).toBe("found");
    expect(seen!.ua).toBe("Test/1.0 (test)");
    expect(seen!.url).toContain("/api/v3/product/3017620422003.json?fields=code,");
  });

  it("maps a 404 product_not_found body to not-found", async () => {
    const body = { result: { id: "product_not_found" }, status: "failure" };
    expect(await fetchOffProduct("50184453", options(json(body, 404)))).toEqual({ status: "not-found" });
  });

  it("reports rate limiting, outages, HTML error pages and timeouts without throwing", async () => {
    expect(await fetchOffProduct("1", options(json({}, 429)))).toEqual({ status: "error", reason: "rate-limited" });
    expect(await fetchOffProduct("1", options(json({}, 503)))).toEqual({ status: "error", reason: "unavailable" });
    const html = (async () => new Response("<!DOCTYPE html>", { status: 200 })) as unknown as typeof fetch;
    expect(await fetchOffProduct("1", options(html))).toEqual({ status: "error", reason: "unavailable" });
    const network = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await fetchOffProduct("1", options(network))).toEqual({ status: "error", reason: "unavailable" });
    const slow = ((_: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    expect(await fetchOffProduct("1", options(slow))).toEqual({ status: "error", reason: "timeout" });
  });
});

describe("RateLimiter", () => {
  it("caps calls per window and recovers afterwards", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
    now = 1001;
    expect(limiter.tryAcquire()).toBe(true);
  });

  it("blocks everything during a cool-down", () => {
    let now = 0;
    const limiter = new RateLimiter(10, 1000, () => now);
    limiter.coolDown(5000);
    expect(limiter.tryAcquire()).toBe(false);
    now = 5001;
    expect(limiter.tryAcquire()).toBe(true);
  });
});

describe("configuredUserAgent", () => {
  it("uses OFF_USER_AGENT when set and a generic default otherwise", () => {
    expect(configuredUserAgent({ OFF_USER_AGENT: " MyApp/2 (me@example.org) " })).toBe("MyApp/2 (me@example.org)");
    expect(configuredUserAgent({})).toMatch(/^Nourish\//);
  });
});
