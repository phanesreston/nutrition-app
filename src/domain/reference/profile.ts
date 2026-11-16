export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";
export type Goal = "lose" | "maintain" | "gain";

/** The parts of a user's profile that reference values depend on. All optional. */
export interface PersonProfile {
  ageYears?: number | null;
  sex?: Sex | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: ActivityLevel | null;
  goal?: Goal | null;
  /** User-defined goals. These override computed defaults and are labelled as such. */
  custom?: {
    energyKcal?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fibreG?: number | null;
  };
}
