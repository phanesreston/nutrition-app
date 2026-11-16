import type { Unit } from "./catalog";

/** A per-100 value above this is physically impossible, so it is a typo. */
export const MAX_PER_100: Record<Unit, number> = { kcal: 900, g: 100, mg: 100_000, "µg": 100_000_000 };

/** Sodium (mg) per gram of salt: salt = sodium × 2.5 (Regulation (EU) No 1169/2011). */
export const SODIUM_MG_PER_G_SALT = 400;
