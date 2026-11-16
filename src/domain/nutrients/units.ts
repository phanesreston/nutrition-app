import Decimal from "decimal.js";
import type { Unit } from "./catalog";

export type MassUnit = "g" | "mg" | "µg";

const MICROGRAMS_PER: Record<MassUnit, Decimal> = {
  g: new Decimal(1_000_000),
  mg: new Decimal(1_000),
  µg: new Decimal(1),
};

export const KJ_PER_KCAL = new Decimal("4.184");

export function isMassUnit(unit: string): unit is MassUnit {
  return unit === "g" || unit === "mg" || unit === "µg";
}

/** USDA and other sources spell units inconsistently ("UG", "mcg", "MG"…). */
export function normaliseUnit(raw: string): Unit | "kJ" | "IU" | null {
  const u = raw.trim().toLowerCase();
  if (u === "g") return "g";
  if (u === "mg") return "mg";
  if (u === "µg" || u === "μg" || u === "ug" || u === "mcg") return "µg";
  if (u === "kcal") return "kcal";
  if (u === "kj") return "kJ";
  if (u === "iu") return "IU";
  return null;
}

export function convertMass(amount: Decimal.Value, from: MassUnit, to: MassUnit): Decimal {
  if (from === to) return new Decimal(amount);
  return new Decimal(amount).times(MICROGRAMS_PER[from]).div(MICROGRAMS_PER[to]);
}

export function kcalToKj(kcal: Decimal.Value): Decimal {
  return new Decimal(kcal).times(KJ_PER_KCAL);
}

export function kjToKcal(kj: Decimal.Value): Decimal {
  return new Decimal(kj).div(KJ_PER_KCAL);
}

/**
 * Convert an amount between any two supported units. Throws when the units
 * are not commensurable (e.g. mg -> kcal) rather than silently returning a
 * wrong number. International Units are deliberately unsupported: the factor
 * depends on the specific compound, so sources must supply mass units.
 */
export function convertAmount(amount: Decimal.Value, from: string, to: Unit): Decimal {
  const source = normaliseUnit(from);
  if (source === null) throw new Error(`Unknown unit "${from}"`);
  if (source === to) return new Decimal(amount);
  if (source === "kJ" && to === "kcal") return kjToKcal(amount);
  if (isMassUnit(source) && isMassUnit(to)) return convertMass(amount, source, to);
  throw new Error(`Cannot convert ${from} to ${to}`);
}
