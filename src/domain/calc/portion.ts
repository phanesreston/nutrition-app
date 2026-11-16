import Decimal from "decimal.js";

/** Grams eaten for `quantity` servings of a portion weighing `gramWeight` g. */
export function gramsForPortion(quantity: Decimal.Value, gramWeight: Decimal.Value): Decimal {
  const q = new Decimal(quantity);
  const w = new Decimal(gramWeight);
  if (q.isNegative() || w.isNegative()) throw new RangeError("Quantity and gram weight must not be negative");
  return q.times(w);
}

/**
 * Scale a per-100 g composition value to the amount actually eaten.
 * A missing value stays missing (null) — it is never coerced to zero.
 */
export function scalePer100g(amountPer100g: Decimal.Value | null | undefined, grams: Decimal.Value): Decimal | null {
  if (amountPer100g === null || amountPer100g === undefined) return null;
  return new Decimal(amountPer100g).times(grams).div(100);
}
