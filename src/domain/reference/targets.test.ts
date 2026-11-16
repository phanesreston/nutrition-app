import { describe, expect, it } from "vitest";
import { computeTargets, estimatedEnergyKcal, restingEnergyKcal } from "./targets";

describe("energy estimate", () => {
  it("applies Mifflin–St Jeor", () => {
    // 10×80 + 6.25×180 − 5×35 + 5 = 1755
    expect(restingEnergyKcal({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 35 })).toBe(1755);
    // 10×65 + 6.25×168 − 5×30 − 161 = 1389
    expect(restingEnergyKcal({ sex: "female", weightKg: 65, heightCm: 168, ageYears: 30 })).toBe(1389);
  });

  it("needs weight, height and age", () => {
    expect(restingEnergyKcal({ sex: "male", weightKg: 80 })).toBeNull();
  });

  it("applies activity and goal, rounded to 10 kcal", () => {
    const p = { sex: "male" as const, weightKg: 80, heightCm: 180, ageYears: 35 };
    expect(estimatedEnergyKcal({ ...p, activityLevel: "moderate", goal: "maintain" })).toBe(2720); // 2720.25
    expect(estimatedEnergyKcal({ ...p, activityLevel: "moderate", goal: "lose" })).toBe(2220);
  });
});

describe("computeTargets", () => {
  it("falls back to generic EU reference intakes for an empty profile", () => {
    const t = computeTargets({});
    expect(t.energy).toMatchObject({ amount: 2000, origin: "generic" });
    expect(t.protein).toMatchObject({ amount: 50, origin: "generic" });
    expect(t.fibre).toMatchObject({ amount: 25, origin: "AI" });
  });

  it("uses sex- and age-specific EFSA values", () => {
    const man = computeTargets({ sex: "male", ageYears: 40 });
    const woman = computeTargets({ sex: "female", ageYears: 40 });
    const older = computeTargets({ sex: "female", ageYears: 60 });
    const young = computeTargets({ sex: "female", ageYears: 20 });
    expect(man.iron?.amount).toBe(11);
    expect(woman.iron?.amount).toBe(16);
    expect(older.iron?.amount).toBe(11);
    expect(man.vitaminC?.amount).toBe(110);
    expect(woman.vitaminC?.amount).toBe(95);
    expect(man.magnesium?.amount).toBe(350);
    expect(woman.magnesium?.amount).toBe(300);
    expect(young.calcium?.amount).toBe(1000);
    expect(woman.calcium?.amount).toBe(950);
  });

  it("scales energy-relative vitamins with the energy target", () => {
    const t = computeTargets({ custom: { energyKcal: 2500 } });
    // 2500 kcal = 10.46 MJ
    expect(t.thiamin?.amount).toBe(1.05);
    expect(t.niacin?.amount).toBe(16.7);
  });

  it("derives protein from body weight", () => {
    expect(computeTargets({ weightKg: 70 }).protein).toMatchObject({ amount: 58.1, origin: "PRI" });
  });

  it("labels user-defined goals and lets them override", () => {
    const t = computeTargets({ weightKg: 70, custom: { proteinG: 120, energyKcal: 1800 } });
    expect(t.protein).toMatchObject({ amount: 120, origin: "user" });
    expect(t.energy).toMatchObject({ amount: 1800, origin: "user" });
    // Derived macros follow the custom energy target: 30% of 1800 / 9
    expect(t.fat).toMatchObject({ amount: 60, origin: "derived" });
    expect(t.carbs).toMatchObject({ amount: 225, origin: "derived" });
  });

  it("marks sodium as a limit and keeps upper levels distinct", () => {
    const t = computeTargets({});
    expect(t.sodium).toMatchObject({ amount: 2000, direction: "limit", origin: "safe-and-adequate" });
    expect(t.vitaminD?.upper).toMatchObject({ amount: 100, kind: "UL", basis: "total" });
    expect(t.magnesium?.upper?.basis).toBe("supplemental-only");
    expect(t.manganese?.upper?.kind).toBe("safe-level");
  });
});
