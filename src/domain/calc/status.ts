import Decimal from "decimal.js";
import type { NutrientTarget } from "../reference/targets";
import { dataCoverage, type DataCoverage, type IntakeSummary, type NutrientIntake } from "./intake";
import type { NutrientKey } from "../nutrients/catalog";

export type IntakeStatus =
  /** Nothing can be said: no logged food has a value for this nutrient. */
  | "no-data"
  /** Below the target (or within the limit for `limit` nutrients it is "within"). */
  | "below"
  | "met"
  /** Under a limit-type target (sodium). */
  | "within"
  /** At or beyond 80% of an applicable upper level. */
  | "near-upper"
  /** Above an applicable upper level, or above a limit-type target. */
  | "over";

export interface UpperAssessment {
  /** Whether the upper level can be evaluated against a food log at all. */
  evaluable: boolean;
  /** Amount of the relevant form consumed (e.g. retinol for vitamin A). */
  consumed: Decimal | null;
  /** consumed / upper, as a fraction. */
  fraction: Decimal | null;
}

export interface NutrientAssessment {
  status: IntakeStatus;
  coverage: DataCoverage;
  consumed: Decimal;
  /** consumed / target as a fraction (1 = 100%), or null without a target. */
  fraction: Decimal | null;
  /** target − consumed, floored at zero. */
  remaining: Decimal | null;
  upper: UpperAssessment | null;
}

/** Fraction of an upper level at which intake is flagged as approaching it. */
export const NEAR_UPPER_FRACTION = new Decimal("0.8");

export function assessNutrient(
  key: NutrientKey,
  summary: IntakeSummary,
  target: NutrientTarget | undefined,
): NutrientAssessment {
  const intake: NutrientIntake = summary[key];
  const coverage = dataCoverage(intake);
  const consumed = intake.total;

  let upper: UpperAssessment | null = null;
  if (target?.upper) {
    const { basis, amount } = target.upper;
    if (basis === "supplemental-only") {
      upper = { evaluable: false, consumed: null, fraction: null };
    } else {
      const relevant = basis === "total" ? intake : summary[basis.nutrient];
      const hasData = relevant.contributions.length > 0;
      upper = {
        evaluable: hasData,
        consumed: hasData ? relevant.total : null,
        fraction: hasData ? relevant.total.div(amount) : null,
      };
    }
  }

  if (!target) {
    return { status: coverage === "no-data" ? "no-data" : "below", coverage, consumed, fraction: null, remaining: null, upper };
  }

  const fraction = consumed.div(target.amount);
  const remaining = Decimal.max(new Decimal(target.amount).minus(consumed), 0);

  let status: IntakeStatus;
  if (coverage === "no-data") {
    status = "no-data";
  } else if (upper?.fraction && upper.fraction.gt(1)) {
    status = "over";
  } else if (target.direction === "limit") {
    status = fraction.gt(1) ? "over" : "within";
  } else if (upper?.fraction && upper.fraction.gte(NEAR_UPPER_FRACTION)) {
    status = "near-upper";
  } else {
    status = fraction.gte(1) ? "met" : "below";
  }

  return { status, coverage, consumed, fraction, remaining, upper };
}
