import { rm } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Next.js request APIs, replaced so server code can run outside a request.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { db } from "@/lib/db";
import { importFoods } from "@/food-sources/import";
import fixtures from "@/food-sources/open-food-facts/fixtures/products.json";
import type { OffProduct } from "@/food-sources/open-food-facts/client";
import { normaliseOffProduct, openFoodFactsInfo } from "@/food-sources/open-food-facts/mapper";
import { adminLogin, recalculateFoodDiary, revertFoodChange, saveFoodEdits } from "@/server/admin/actions";
import { applyFoodEdits, recalculateDiaryEntries, revertAudit } from "@/server/admin/food-admin";
import { ImageRejected, processUpload, readFoodImage, storeFoodImage, uploadDir } from "@/server/admin/images";
import { ADMIN_COOKIE, createSessionToken } from "@/server/admin/session";
import { lookupBarcode } from "@/server/barcode";
import { getDayView } from "@/server/day";
import { getFood, searchFoods } from "@/server/foods";
import { snapshotNutrients } from "@/server/snapshot";

const BARCODE = "5010029000023"; // Weetabix
const weetabix = () => normaliseOffProduct(fixtures.weetabix.product as OffProduct, BARCODE)!;

let adminId: string;
let foodId: string;

async function resetDatabase() {
  await db.diaryEntry.deleteMany();
  await db.food.deleteMany(); // cascades to nutrients, portions, overrides, images, audits
  await db.foodSource.deleteMany();
  await db.user.deleteMany();
  const user = await db.user.create({ data: { email: "local@nutrition.app", name: "Test admin", profile: { create: {} } } });
  adminId = user.id;
  await importFoods(db, openFoodFactsInfo, [weetabix()], { fetchedAt: new Date() });
  foodId = (await db.food.findFirstOrThrow({ where: { barcode: BARCODE } })).id;
}

const nutrient = async (key: string) =>
  (await db.foodNutrient.findUnique({ where: { foodId_nutrientKey: { foodId, nutrientKey: key } } })) ?? null;

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toMatch(/_test(\?|$)/); // never the development database
});
beforeEach(async () => {
  cookieJar.clear();
  vi.unstubAllGlobals();
  await resetDatabase();
});
afterAll(async () => {
  await rm(uploadDir(), { recursive: true, force: true });
  await db.$disconnect();
});

describe("administrators can update products", () => {
  it("stores corrections as overrides and updates the effective food", async () => {
    const result = await applyFoodEdits(db, adminId, foodId, [
      { field: "name", value: "Weetabix Original" },
      { field: "n:iron", value: "11.9" },
      { field: "n:calcium", value: "35", estimated: true },
      { field: "description", value: "Wholegrain wheat biscuits" },
    ]);
    expect(result).toEqual({ ok: true, changed: 4 });

    const food = await db.food.findUniqueOrThrow({ where: { id: foodId } });
    expect(food.name).toBe("Weetabix Original");
    expect(food.description).toBe("Wholegrain wheat biscuits");
    expect(food.editedAt).not.toBeNull();
    expect((await nutrient("iron"))!.amount.toString()).toBe("11.9");
    expect((await nutrient("iron"))!.origin).toBe("admin");
    expect((await nutrient("calcium"))!.origin).toBe("admin-estimate");
    expect((await nutrient("energy"))!.origin).toBe("label"); // untouched values keep their origin

    // The imported record is retained, unmodified.
    const source = food.sourceData as { name: string; nutrients: Record<string, { amount: string }> };
    expect(source.name).toBe("Original");
    expect(source.nutrients.iron.amount).toBe("12");
    expect(source.nutrients.calcium).toBeUndefined();
  });

  it("persists: a fresh read, search and barcode lookup all return the corrected values", async () => {
    await applyFoodEdits(db, adminId, foodId, [
      { field: "name", value: "Weetabix Original" },
      { field: "n:iron", value: "11.9" },
    ]);
    const view = (await getFood(foodId, adminId))!;
    expect(view.name).toBe("Weetabix Original");
    expect(view.per100g.iron).toBe(11.9);

    expect((await searchFoods("weetabix original", 10, adminId)).map((f) => f.id)).toContain(foodId);

    const lookup = await lookupBarcode(adminId, BARCODE);
    expect(lookup).toMatchObject({ status: "found", origin: "cache" });
    if (lookup.status === "found") {
      expect(lookup.food.name).toBe("Weetabix Original");
      expect(lookup.food.per100g.iron).toBe(11.9);
    }
  });

  it("finds a product under its corrected barcode", async () => {
    const result = await applyFoodEdits(db, adminId, foodId, [{ field: "barcode", value: "50184453" }]);
    expect(result.ok).toBe(true);
    const lookup = await lookupBarcode(adminId, "50184453");
    expect(lookup).toMatchObject({ status: "found", food: { id: foodId } });
  });

  it("keeps zero and unknown distinct", async () => {
    await applyFoodEdits(db, adminId, foodId, [
      { field: "n:vitaminC", value: "0" }, // really none
      { field: "n:iron", value: null }, // we do not know after all
    ]);
    expect((await nutrient("vitaminC"))!.amount.toString()).toBe("0");
    expect(await nutrient("iron")).toBeNull();
    expect(await nutrient("vitaminD")).toBeNull(); // never stated: still unknown, not zero
  });

  it("rejects an invalid save as a whole", async () => {
    const result = await applyFoodEdits(db, adminId, foodId, [
      { field: "name", value: "Should not be saved" },
      { field: "n:protein", value: "250" }, // 250 g per 100 g
    ]);
    expect(result).toEqual({ ok: false, error: "Protein: 250 g per 100 g is not possible" });
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).name).toBe("Original");
    expect(await db.foodOverride.count()).toBe(0);
    expect(await db.foodAudit.count()).toBe(0);

    for (const bad of [
      { field: "name", value: "  " },
      { field: "n:iron", value: "-1" },
      { field: "n:iron", value: "abc" },
      { field: "barcode", value: "5010029000024" },
      { field: "amountUnit", value: "oz" },
      { field: "servingSize", value: "0" },
      { field: "sourceData", value: "{}" },
    ]) {
      expect((await applyFoodEdits(db, adminId, foodId, [bad])).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("imports never overwrite corrections", () => {
  const changedSource = () => {
    const next = weetabix();
    next.name = "Original (new recipe)";
    next.nutrients.iron = { amount: "14", unit: "mg" };
    next.nutrients.energy = { amount: "365", unit: "kcal" };
    return next;
  };

  it("re-applies corrections on top of a bulk re-import", async () => {
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "11.9" }]);
    await importFoods(db, openFoodFactsInfo, [changedSource()], { fetchedAt: new Date() });

    expect((await nutrient("iron"))!.amount.toString()).toBe("11.9"); // correction kept
    expect((await nutrient("energy"))!.amount.toString()).toBe("365"); // uncorrected value follows the source
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).name).toBe("Original (new recipe)");
  });

  it("re-applies corrections when a barcode scan refreshes an expired product from Open Food Facts", async () => {
    await applyFoodEdits(db, adminId, foodId, [
      { field: "name", value: "Weetabix Original" },
      { field: "n:iron", value: "11.9" },
    ]);
    await db.food.update({ where: { id: foodId }, data: { fetchedAt: new Date(Date.now() - 45 * 24 * 3600 * 1000) } });

    const upstream = structuredClone(fixtures.weetabix) as { product: { nutriments: Record<string, number>; product_name: string; product_name_en?: string } };
    upstream.product.product_name = upstream.product.product_name_en = "Upstream renamed it";
    upstream.product.nutriments.iron_100g = 0.02;
    upstream.product.nutriments["energy-kcal_100g"] = 370;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(upstream), { status: 200 })));

    const lookup = await lookupBarcode(adminId, BARCODE);
    expect(lookup).toMatchObject({ status: "found", origin: "open-food-facts" }); // it really did re-fetch
    if (lookup.status !== "found") return;
    expect(lookup.food.name).toBe("Weetabix Original");
    expect(lookup.food.per100g.iron).toBe(11.9);
    expect(lookup.food.per100g.energy).toBe(370);
  });

  it("restores an individual field to its imported value", async () => {
    await applyFoodEdits(db, adminId, foodId, [
      { field: "n:iron", value: "11.9" },
      { field: "name", value: "Weetabix Original" },
    ]);
    const result = await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", restore: true }]);
    expect(result).toEqual({ ok: true, changed: 1 });
    expect((await nutrient("iron"))!.amount.toString()).toBe("12");
    expect((await nutrient("iron"))!.origin).toBe("label");
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).name).toBe("Weetabix Original"); // other corrections stay
  });

  it("drops the override when a value is typed back to what the source says", async () => {
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "11.9" }]);
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "12.0" }]);
    expect(await db.foodOverride.count()).toBe(0);
  });
});

describe("edit history", () => {
  it("records field, old value, new value, administrator and time", async () => {
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "11.9" }]);
    const [audit] = await db.foodAudit.findMany();
    expect(audit).toMatchObject({ foodId, field: "n:iron", oldValue: "12", newValue: "11.9", action: "edit", adminId });
    expect(Date.now() - audit.createdAt.getTime()).toBeLessThan(60_000);
  });

  it("does not log a save that changes nothing", async () => {
    expect(await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "12" }])).toEqual({ ok: true, changed: 0 });
    expect(await db.foodAudit.count()).toBe(0);
  });

  it("reverts an individual edit", async () => {
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "11.9" }]);
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "10" }]);
    const second = await db.foodAudit.findFirstOrThrow({ where: { newValue: "10" } });
    expect(await revertAudit(db, adminId, second.id)).toEqual({ ok: true, changed: 1 });
    expect((await nutrient("iron"))!.amount.toString()).toBe("11.9");
    expect(await db.foodAudit.count({ where: { action: "revert" } })).toBe(1);
  });
});

describe("unauthorised users cannot use admin mutations", () => {
  const untouched = async () => {
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).name).toBe("Original");
    expect(await db.foodOverride.count()).toBe(0);
  };

  it("refuses every mutation without a session", async () => {
    expect(await saveFoodEdits(foodId, [{ field: "name", value: "Hacked" }])).toMatchObject({ ok: false });
    expect(await recalculateFoodDiary(foodId)).toMatchObject({ ok: false });
    expect(await revertFoodChange("anything")).toMatchObject({ ok: false });
    await untouched();
  });

  it("refuses forged and expired session cookies", async () => {
    for (const token of [
      "admin",
      "v1.admin.99999999999999.forged",
      createSessionToken("not-the-real-password"),
      createSessionToken(process.env.ADMIN_PASSWORD!, Date.now() - 13 * 3600 * 1000), // expired an hour ago
    ]) {
      cookieJar.set(ADMIN_COOKIE, token);
      expect(await saveFoodEdits(foodId, [{ field: "name", value: "Hacked" }])).toMatchObject({ ok: false });
    }
    await untouched();
  });

  it("allows mutations with a valid session", async () => {
    cookieJar.set(ADMIN_COOKIE, createSessionToken(process.env.ADMIN_PASSWORD!));
    expect(await saveFoodEdits(foodId, [{ field: "name", value: "Weetabix Original" }])).toEqual({ ok: true, changed: 1 });
  });

  it("signs in only with the configured password, and only redirects into /admin", async () => {
    const form = (password: string, next = "/admin") => {
      const f = new FormData();
      f.set("password", password);
      f.set("next", next);
      return f;
    };
    expect(await adminLogin(null, form("wrong password"))).toEqual({ error: "That password is not correct." });
    expect(cookieJar.has(ADMIN_COOKIE)).toBe(false);
    await expect(adminLogin(null, form(process.env.ADMIN_PASSWORD!, "https://evil.example/"))).rejects.toThrow("REDIRECT:/admin");
    expect(cookieJar.has(ADMIN_COOKIE)).toBe(true);
  });
});

describe("images can be replaced safely", () => {
  const picture = (format: "jpeg" | "png" | "webp", size = 400) =>
    sharp({ create: { width: size, height: size, channels: 3, background: { r: 200, g: 60, b: 60 } } })
      .toFormat(format)
      .toBuffer();

  it("accepts JPG, PNG and WebP and stores them re-encoded", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const out = await processUpload(await picture(format));
      expect(out.mimeType).toBe("image/webp");
      expect((await sharp(out.data).metadata()).format).toBe("webp");
    }
  });

  it("shrinks large photos and strips metadata such as GPS location", async () => {
    const withExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#888" } })
      .jpeg()
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processUpload(withExif);
    expect(Math.max(out.width, out.height)).toBe(1200);
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
  });

  it("rejects files that are not really images, whatever they claim to be", async () => {
    const gif = Buffer.from("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b", "hex");
    const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("<script>alert(1)</script>")]);
    for (const bad of [Buffer.from("<html><script>alert(1)</script></html>"), gif, fakePng, Buffer.alloc(0), await picture("png", 40)]) {
      await expect(processUpload(bad)).rejects.toBeInstanceOf(ImageRejected);
    }
    await expect(processUpload(Buffer.alloc(9 * 1024 * 1024, 0xff))).rejects.toThrow("larger than 8 MB");
  });

  it("stores under a generated name, serves by id, and switches the product's photo", async () => {
    const originalUrl = (await db.food.findUniqueOrThrow({ where: { id: foodId } })).imageUrl;
    expect(originalUrl).toMatch(/^https:\/\/images\.openfoodfacts\.org\//);

    const imageId = await storeFoodImage(db, adminId, foodId, await picture("jpeg"));
    const row = await db.foodImage.findUniqueOrThrow({ where: { id: imageId } });
    expect(row.filename).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect((await readFoodImage(db, imageId))!.mimeType).toBe("image/webp");
    expect(await readFoodImage(db, "does-not-exist")).toBeNull();

    // Uploading alone changes nothing; saving the choice does.
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).imageUrl).toBe(originalUrl);
    await applyFoodEdits(db, adminId, foodId, [{ field: "image", value: `upload:${imageId}` }]);
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).imageUrl).toBe(`/api/images/${imageId}`);

    // A re-import does not bring the old photo back.
    await importFoods(db, openFoodFactsInfo, [weetabix()], { fetchedAt: new Date() });
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).imageUrl).toBe(`/api/images/${imageId}`);

    // Remove, then restore the original.
    await applyFoodEdits(db, adminId, foodId, [{ field: "image", value: "none" }]);
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).imageUrl).toBeNull();
    await applyFoodEdits(db, adminId, foodId, [{ field: "image", restore: true }]);
    expect((await db.food.findUniqueOrThrow({ where: { id: foodId } })).imageUrl).toBe(originalUrl);
  });

  it("refuses an image that belongs to a different product", async () => {
    const other = { ...weetabix(), sourceFoodId: "50184453", barcode: "50184453", name: "Other" };
    await importFoods(db, openFoodFactsInfo, [other]);
    const otherId = (await db.food.findFirstOrThrow({ where: { barcode: "50184453" } })).id;
    const imageId = await storeFoodImage(db, adminId, otherId, await picture("png"));
    const result = await applyFoodEdits(db, adminId, foodId, [{ field: "image", value: `upload:${imageId}` }]);
    expect(result).toEqual({ ok: false, error: "Photograph: that image does not belong to this product" });
  });
});

describe("diary entries and nutrition totals", () => {
  const today = "2026-01-15";
  const logTwoBiscuits = async () =>
    db.diaryEntry.create({
      data: {
        userId: adminId,
        foodId,
        date: new Date(`${today}T00:00:00Z`),
        meal: "BREAKFAST",
        quantity: "2",
        unitLabel: "1 serving",
        unitGrams: "37.5",
        grams: "75",
        per100g: await snapshotNutrients(db, foodId),
      },
    });

  it("calculates totals from the logged values", async () => {
    await logTwoBiscuits();
    const day = await getDayView(adminId, today);
    expect(day.nutrients.iron.consumed).toBe(9); // 12 mg/100 g × 75 g
    expect(day.nutrients.energy.consumed).toBe(271.5); // 362 kcal/100 g × 75 g
    expect(day.nutrients.vitaminC.status).toBe("no-data"); // unknown stays unknown
  });

  it("does not change past entries when a product is corrected, but new entries use the correction", async () => {
    await logTwoBiscuits();
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "8" }, { field: "n:vitaminC", value: "20" }]);

    let day = await getDayView(adminId, today);
    expect(day.nutrients.iron.consumed).toBe(9); // still the values it was logged with
    expect(day.nutrients.vitaminC.status).toBe("no-data");

    await logTwoBiscuits(); // logged after the correction
    day = await getDayView(adminId, today);
    expect(day.nutrients.iron.consumed).toBe(15); // 9 (old entry) + 6 (new entry at 8 mg/100 g)
    expect(day.nutrients.vitaminC.consumed).toBe(15); // only the new entry has a value…
    expect(day.nutrients.vitaminC.coverage).toBe("partial"); // …and the old one is flagged as unknown
  });

  it("recalculates past entries only when an administrator asks for it", async () => {
    await logTwoBiscuits();
    await applyFoodEdits(db, adminId, foodId, [{ field: "n:iron", value: "8" }]);
    expect(await recalculateDiaryEntries(db, adminId, foodId)).toEqual({ ok: true, entries: 1 });
    expect((await getDayView(adminId, today)).nutrients.iron.consumed).toBe(6);
    expect(await db.foodAudit.findFirst({ where: { action: "recalculate" } })).toMatchObject({ newValue: "1 past entries recalculated" });
  });
});
