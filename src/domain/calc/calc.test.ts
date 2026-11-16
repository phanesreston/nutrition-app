import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { gramsForPortion, scalePer100g } from "./portion";
import { dataCoverage, macroEnergySplit, summariseIntake, type IntakeItem } from "./intake";
import { assessNutrient } from "./status";
import { computeTargets } from "../reference/targets";

// Per-100 g values copied from USDA SR Legacy (FDC ids in comments).
const kale: IntakeItem = {
  id: "kale",
  label: "Kale, raw", // FDC 168421
  grams: 21, // 1 cup
  per100g: { energy: 35, protein: 2.92, potassium: 348, vitaminC: 93.4, vitaminK: 390, retinol: 0 },
};
const brazil: IntakeItem = {
  id: "brazil",
  label: "Nuts, brazilnuts, dried, unblanched", // FDC 170569
  grams: 30,
  per100g: { energy: 659, protein: 14.32, potassium: 659, selenium: 1917, vitaminC: 0.7 },
};

describe("portion maths", () => {
  it("converts household portions to grams exactly", () => {
    expect(gramsForPortion("1.5", "21").toString()).toBe("31.5");
    expect(gramsForPortion("0.1", "0.2").toString()).toBe("0.02"); // no binary float drift
  });

  it("scales per-100 g values to the amount eaten", () => {
    expect(scalePer100g("348", 21)!.toString()).toBe("73.08");
    expect(scalePer100g("93.4", "31.5")!.toString()).toBe("29.421");
  });

  it("keeps missing values missing", () => {
    expect(scalePer100g(null, 100)).toBeNull();
    expect(scalePer100g(undefined, 100)).toBeNull();
    expect(scalePer100g(0, 100)!.toString()).toBe("0");
  });

  it("rejects negative amounts", () => {
    expect(() => gramsForPortion(-1, 10)).toThrow(RangeError);
  });
});

describe("summariseIntake", () => {
  const summary = summariseIntake([kale, brazil]);

  it("sums known values with decimal precision", () => {
    expect(summary.energy.total.toString()).toBe("205.05"); // 7.35 + 197.7
    expect(summary.potassium.total.toString()).toBe("270.78"); // 73.08 + 197.7
    expect(summary.selenium.total.toString()).toBe("575.1");
  });

  it("separates unknown values from zero", () => {
    // Selenium is unknown for kale in this fixture, known for brazil nuts.
    expect(summary.selenium.missing.map((m) => m.itemId)).toEqual(["kale"]);
    expect(dataCoverage(summary.selenium)).toBe("partial");
    // Retinol is a true zero for kale and unknown for brazil nuts.
    expect(summary.retinol.contributions).toHaveLength(1);
    expect(summary.retinol.total.isZero()).toBe(true);
    // Nobody reports iodine.
    expect(dataCoverage(summary.iodine)).toBe("no-data");
    expect(dataCoverage(summary.energy)).toBe("complete");
  });

  it("reports nothing logged distinctly from no data", () => {
    expect(dataCoverage(summariseIntake([]).iodine)).toBe("none-logged");
  });

  it("records each item's contribution", () => {
    const c = summary.potassium.contributions.find((x) => x.itemId === "brazil");
    expect(c?.amount.toString()).toBe("197.7");
  });
});

describe("macroEnergySplit", () => {
  it("uses Atwater factors", () => {
    const split = macroEnergySplit({ protein: 25, carbs: 50, fat: 20 })!;
    // 100 + 200 + 180 = 480 kcal
    expect(split.protein.toFixed(4)).toBe("0.2083");
    expect(split.carbs.toFixed(4)).toBe("0.4167");
    expect(split.fat.toFixed(4)).toBe("0.3750");
  });
  it("is null when nothing is logged", () => {
    expect(macroEnergySplit({ protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });
});

describe("assessNutrient", () => {
  const targets = computeTargets({ sex: "female", ageYears: 30, weightKg: 65, heightCm: 168 });
  const summary = summariseIntake([kale, brazil]);

  it("flags intake above a tolerable upper level", () => {
    const a = assessNutrient("selenium", summary, targets.selenium);
    expect(a.status).toBe("over"); // 575 µg vs UL 255 µg
    expect(a.coverage).toBe("partial");
  });

  it("reports below-target intake with the remaining amount", () => {
    const a = assessNutrient("potassium", summary, targets.potassium);
    expect(a.status).toBe("below");
    expect(a.remaining!.toString()).toBe("3229.22");
    expect(a.fraction!.toFixed(4)).toBe("0.0774");
  });

  it("returns no-data instead of 0% when nothing reports the nutrient", () => {
    expect(assessNutrient("iodine", summary, targets.iodine).status).toBe("no-data");
  });

  it("marks met targets", () => {
    const a = assessNutrient("vitaminK", summary, targets.vitaminK); // 81.9 µg vs AI 70
    expect(a.status).toBe("met");
  });

  it("treats sodium as a limit, not a goal", () => {
    const salty = summariseIntake([{ id: "s", label: "Salt, table", grams: 6, per100g: { sodium: 38758 } }]);
    expect(assessNutrient("sodium", salty, targets.sodium).status).toBe("over");
    const low = summariseIntake([{ id: "s", label: "Salt, table", grams: 1, per100g: { sodium: 38758 } }]);
    expect(assessNutrient("sodium", low, targets.sodium).status).toBe("within");
  });

  it("evaluates the vitamin A upper level against retinol only", () => {
    // Lots of carotenoid vitamin A, no retinol: must not trip the UL.
    const carrots = summariseIntake([
      { id: "c", label: "Carrots", grams: 1000, per100g: { vitaminA: 835, retinol: 0 } },
    ]);
    const a = assessNutrient("vitaminA", carrots, targets.vitaminA);
    expect(a.consumed.toNumber()).toBe(8350);
    expect(a.status).toBe("met");
    // Liver: retinol-rich.
    const liver = summariseIntake([
      { id: "l", label: "Beef liver", grams: 100, per100g: { vitaminA: 9442, retinol: 9428 } },
    ]);
    expect(assessNutrient("vitaminA", liver, targets.vitaminA).status).toBe("over");
  });

  it("does not evaluate supplement-only upper levels against food", () => {
    const seeds = summariseIntake([{ id: "p", label: "Pumpkin seeds", grams: 100, per100g: { magnesium: 592 } }]);
    const a = assessNutrient("magnesium", seeds, targets.magnesium);
    expect(a.upper?.evaluable).toBe(false);
    expect(a.status).toBe("met");
  });

  it("flags intake approaching an upper level", () => {
    const zinc = summariseIntake([{ id: "o", label: "Oysters", grams: 100, per100g: { zinc: 21 } }]);
    expect(assessNutrient("zinc", zinc, targets.zinc).status).toBe("near-upper"); // 21 of UL 25
  });
});

describe("Decimal interop", () => {
  it("accepts Prisma-style decimal strings", () => {
    expect(scalePer100g(new Decimal("0.1"), new Decimal("0.3"))!.toString()).toBe("0.0003");
  });
});
