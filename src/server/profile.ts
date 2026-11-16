import "server-only";
import type { Profile } from "@prisma/client";
import { db } from "@/lib/db";
import type { ActivityLevel, Goal, PersonProfile, Sex } from "@/domain/reference/profile";
import { computeTargets, type Targets } from "@/domain/reference/targets";

const SEX: Record<string, Sex> = { MALE: "male", FEMALE: "female" };
const ACTIVITY: Record<string, ActivityLevel> = {
  SEDENTARY: "sedentary",
  LIGHT: "light",
  MODERATE: "moderate",
  ACTIVE: "active",
  VERY_ACTIVE: "veryActive",
};
const GOAL: Record<string, Goal> = { LOSE: "lose", MAINTAIN: "maintain", GAIN: "gain" };

export function toPersonProfile(p: Profile | null, now: Date = new Date()): PersonProfile {
  if (!p) return {};
  return {
    ageYears: p.birthYear ? now.getFullYear() - p.birthYear : null,
    sex: p.sex ? SEX[p.sex] : null,
    heightCm: p.heightCm?.toNumber() ?? null,
    weightKg: p.weightKg?.toNumber() ?? null,
    activityLevel: p.activityLevel ? ACTIVITY[p.activityLevel] : null,
    goal: p.goal ? GOAL[p.goal] : null,
    custom: {
      energyKcal: p.energyTargetKcal,
      proteinG: p.proteinTargetG?.toNumber() ?? null,
      carbsG: p.carbsTargetG?.toNumber() ?? null,
      fatG: p.fatTargetG?.toNumber() ?? null,
      fibreG: p.fibreTargetG?.toNumber() ?? null,
    },
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return db.profile.findUnique({ where: { userId } });
}

export async function getTargets(userId: string): Promise<Targets> {
  return computeTargets(toPersonProfile(await getProfile(userId)));
}
