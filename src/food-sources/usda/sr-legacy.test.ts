import { describe, expect, it } from "vitest";
import { usdaSrLegacy, type FdcFood } from "./sr-legacy";

const n = (id: number, unitName: string, amount?: number) => ({ nutrient: { id, name: "", unitName }, amount });

const raw: FdcFood = {
  fdcId: 168421,
  description: "Kale, raw (Includes foods for USDA's Food Distribution Program)",
  foodCategory: { description: "Vegetables and Vegetable Products" },
  foodNutrients: [
    n(1008, "kcal", 35),
    n(1062, "kJ", 148), // unmapped: ignored
    n(1003, "g", 2.92),
    n(1092, "mg", 348),
    n(1106, "µg", 241),
    n(1103, "µg"), // amount absent: stays missing
    n(1186, "µg", 0), // a reported zero is kept
  ],
  foodPortions: [
    { amount: 1, modifier: "cup, chopped", gramWeight: 21, sequenceNumber: 2, measureUnit: { name: "undetermined" } },
    { amount: 1, modifier: "leaf", gramWeight: 0, sequenceNumber: 1 },
  ],
};

describe("USDA SR Legacy adapter", () => {
  const food = usdaSrLegacy.normalise(raw)!;

  it("retains source identity", () => {
    expect(food.sourceId).toBe("usda-sr-legacy");
    expect(food.sourceFoodId).toBe("168421");
    expect(food.name).toBe("Kale, raw");
  });

  it("maps nutrients to catalogue keys and units", () => {
    expect(food.nutrients.energy).toEqual({ amount: "35", unit: "kcal" });
    expect(food.nutrients.potassium).toEqual({ amount: "348", unit: "mg" });
    expect(food.nutrients.vitaminA).toEqual({ amount: "241", unit: "µg" });
  });

  it("keeps zero and missing distinct", () => {
    expect(food.nutrients.folicAcid).toEqual({ amount: "0", unit: "µg" });
    expect(food.nutrients.selenium).toBeUndefined();
    expect(food.nutrients.iodine).toBeUndefined();
  });

  it("keeps only portions with a usable gram weight", () => {
    expect(food.portions).toEqual([{ label: "1 cup, chopped", gramWeight: "21" }]);
  });

  it("skips foods without an energy value", () => {
    expect(usdaSrLegacy.normalise({ ...raw, foodNutrients: [n(1003, "g", 1)] })).toBeNull();
  });
});
