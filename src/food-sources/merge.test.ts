import { describe, expect, it } from "vitest";
import { effectiveValue, fieldStatus, matchesSource, mergeFood, sourceValue, type Override } from "./merge";
import type { NormalisedFood } from "./types";

const imported: NormalisedFood = {
  sourceId: "open-food-facts",
  sourceFoodId: "5010029000023",
  barcode: "5010029000023",
  name: "Original",
  brand: "Weetabix",
  category: "Cereals",
  imageUrl: "https://images.openfoodfacts.org/x.jpg",
  ingredients: "Wheat",
  amountUnit: "g",
  nutrients: {
    energy: { amount: "362", unit: "kcal" },
    iron: { amount: "12", unit: "mg" },
    fibre: { amount: "0", unit: "g" },
  },
  portions: [
    { label: "1 serving", gramWeight: "37.5" },
    { label: "1 package", gramWeight: "430" },
  ],
};

describe("mergeFood", () => {
  it("returns the imported record unchanged when there are no overrides", () => {
    const { food, nutrientOrigins } = mergeFood(imported, []);
    expect(food).toEqual(imported);
    expect(nutrientOrigins).toEqual({ energy: "label", iron: "label", fibre: "label" });
  });

  it("lets an administrator override beat the imported value", () => {
    const overrides: Override[] = [
      { field: "name", value: "Weetabix Original" },
      { field: "n:iron", value: "11.9" },
      { field: "n:calcium", value: "35", estimated: true },
    ];
    const { food, nutrientOrigins } = mergeFood(imported, overrides);
    expect(food.name).toBe("Weetabix Original");
    expect(food.nutrients.iron).toEqual({ amount: "11.9", unit: "mg" });
    expect(food.nutrients.calcium).toEqual({ amount: "35", unit: "mg" });
    expect(nutrientOrigins).toMatchObject({ iron: "admin", calcium: "admin-estimate", energy: "label" });
    // The imported record itself is never mutated.
    expect(imported.name).toBe("Original");
    expect(imported.nutrients.iron?.amount).toBe("12");
  });

  it("keeps zero, unknown and 'set to unknown' distinct", () => {
    const { food } = mergeFood(imported, [
      { field: "n:fibre", value: null }, // source says 0; admin says "we don't know"
      { field: "n:vitaminC", value: "0" }, // source silent; admin says "really zero"
    ]);
    expect(food.nutrients.fibre).toBeUndefined();
    expect(food.nutrients.vitaminC).toEqual({ amount: "0", unit: "mg" });
    expect(food.nutrients.vitaminD).toBeUndefined();
  });

  it("survives a re-import: new source data, same overrides", () => {
    const overrides: Override[] = [{ field: "n:iron", value: "11.9" }, { field: "brand", value: "Weetabix Ltd" }];
    const reimported: NormalisedFood = {
      ...imported,
      name: "Original (new recipe)",
      brand: "WEETABIX",
      nutrients: { ...imported.nutrients, iron: { amount: "14", unit: "mg" }, energy: { amount: "365", unit: "kcal" } },
    };
    const { food } = mergeFood(reimported, overrides);
    expect(food.nutrients.iron?.amount).toBe("11.9"); // correction kept
    expect(food.brand).toBe("Weetabix Ltd"); // correction kept
    expect(food.nutrients.energy?.amount).toBe("365"); // uncorrected field follows the source
    expect(food.name).toBe("Original (new recipe)");
  });

  it("edits serving and package sizes without touching other portions", () => {
    const usda: NormalisedFood = { ...imported, sourceId: "usda-sr-legacy", portions: [{ label: "1 cup", gramWeight: "21" }] };
    const { food, nutrientOrigins } = mergeFood(usda, [
      { field: "servingSize", value: "30" },
      { field: "packageQuantity", value: "500" },
    ]);
    expect(food.portions).toEqual([
      { label: "1 serving", gramWeight: "30" },
      { label: "1 package", gramWeight: "500" },
      { label: "1 cup", gramWeight: "21" },
    ]);
    expect(nutrientOrigins.energy).toBe("reference");
    expect(mergeFood(imported, [{ field: "servingSize", value: null }]).food.portions).toEqual([
      { label: "1 package", gramWeight: "430" },
    ]);
  });

  it("resolves the preferred image", () => {
    expect(mergeFood(imported, [{ field: "image", value: "upload:abc123" }]).food.imageUrl).toBe("/api/images/abc123");
    expect(mergeFood(imported, [{ field: "image", value: "none" }]).food.imageUrl).toBeNull();
    expect(mergeFood(imported, [{ field: "image", value: "source" }]).food.imageUrl).toBe(imported.imageUrl);
  });

  it("never lets a food lose its name and ignores unknown fields", () => {
    const { food } = mergeFood(imported, [{ field: "name", value: null }, { field: "n:notANutrient", value: "1" }, { field: "hax", value: "x" }]);
    expect(food.name).toBe("Original");
    expect(Object.keys(food.nutrients)).toEqual(["energy", "iron", "fibre"]);
  });
});

describe("field helpers", () => {
  const overrides: Override[] = [
    { field: "n:iron", value: "11.9" },
    { field: "n:calcium", value: "35", estimated: true },
    { field: "n:fibre", value: null },
  ];

  it("reports the status of each field", () => {
    expect(fieldStatus(imported, overrides, "n:energy")).toBe("original");
    expect(fieldStatus(imported, overrides, "n:iron")).toBe("corrected");
    expect(fieldStatus(imported, overrides, "n:calcium")).toBe("estimated");
    expect(fieldStatus(imported, overrides, "n:fibre")).toBe("corrected"); // cleared by an admin
    expect(fieldStatus(imported, overrides, "n:zinc")).toBe("unknown");
    expect(fieldStatus(imported, overrides, "description")).toBe("unknown");
  });

  it("reads source and effective values", () => {
    expect(sourceValue(imported, "servingSize")).toBe("37.5");
    expect(sourceValue(imported, "n:iron")).toBe("12");
    expect(effectiveValue(imported, overrides, "n:iron")).toBe("11.9");
    expect(effectiveValue(imported, overrides, "n:fibre")).toBeNull();
    expect(effectiveValue(imported, overrides, "brand")).toBe("Weetabix");
  });

  it("recognises a value that merely repeats the source", () => {
    expect(matchesSource(imported, "n:iron", "12.0")).toBe(true);
    expect(matchesSource(imported, "n:iron", "12.5")).toBe(false);
    expect(matchesSource(imported, "n:fibre", "0")).toBe(true);
    expect(matchesSource(imported, "n:fibre", null)).toBe(false); // zero is not unknown
    expect(matchesSource(imported, "n:zinc", null)).toBe(true);
    expect(matchesSource(imported, "name", "Original")).toBe(true);
  });
});
