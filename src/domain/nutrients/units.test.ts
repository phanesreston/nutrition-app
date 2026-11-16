import { describe, expect, it } from "vitest";
import { convertAmount, convertMass, kcalToKj, normaliseUnit } from "./units";

describe("unit conversion", () => {
  it("converts between mass units exactly", () => {
    expect(convertMass(1, "g", "mg").toString()).toBe("1000");
    expect(convertMass("2.5", "mg", "µg").toString()).toBe("2500");
    expect(convertMass(400, "µg", "mg").toString()).toBe("0.4");
    expect(convertMass("0.07", "g", "µg").toString()).toBe("70000");
  });

  it("normalises source spellings", () => {
    expect(normaliseUnit("UG")).toBe("µg");
    expect(normaliseUnit("mcg")).toBe("µg");
    expect(normaliseUnit("μg")).toBe("µg"); // Greek mu
    expect(normaliseUnit("MG")).toBe("mg");
    expect(normaliseUnit("KCAL")).toBe("kcal");
    expect(normaliseUnit("furlong")).toBeNull();
  });

  it("converts energy", () => {
    expect(kcalToKj(100).toString()).toBe("418.4");
    expect(convertAmount("418.4", "kJ", "kcal").toString()).toBe("100");
  });

  it("refuses incommensurable or ambiguous conversions", () => {
    expect(() => convertAmount(1, "mg", "kcal")).toThrow();
    expect(() => convertAmount(100, "IU", "µg")).toThrow();
    expect(() => convertAmount(1, "furlong", "g")).toThrow();
  });
});
