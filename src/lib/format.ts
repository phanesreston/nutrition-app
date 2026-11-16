import { NUTRIENTS, type NutrientKey } from "@/domain/nutrients/catalog";

const formatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, decimals = 0): string {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { maximumFractionDigits: decimals });
    formatters.set(decimals, f);
  }
  return f.format(value);
}

/** Format an amount with the nutrient's display precision (without unit). */
export function formatAmount(key: NutrientKey, value: number): string {
  return formatNumber(value, NUTRIENTS[key].decimals);
}

export function formatWithUnit(key: NutrientKey, value: number): string {
  return `${formatAmount(key, value)} ${NUTRIENTS[key].unit}`;
}

export function formatPercent(fraction: number): string {
  // Never round a not-quite-met target up to "100%".
  const percent = fraction < 1 ? Math.min(Math.round(fraction * 100), 99) : Math.round(fraction * 100);
  return `${formatNumber(percent)}%`;
}

export function formatGrams(grams: number): string {
  return `${formatNumber(grams, grams < 10 ? 1 : 0)} g`;
}
