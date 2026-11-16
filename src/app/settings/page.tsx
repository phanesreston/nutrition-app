import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CORE_KEYS, NUTRIENTS } from "@/domain/nutrients/catalog";
import { ORIGIN_LABELS, type TargetOrigin } from "@/domain/reference/targets";
import { formatNumber, formatWithUnit } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { listFoodSources } from "@/server/foods";
import { getProfile, getTargets } from "@/server/profile";

export const metadata: Metadata = { title: "Settings" };

const str = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? "" : v.toString());

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const [profile, targets, sources] = await Promise.all([getProfile(user.id), getTargets(user.id), listFoodSources()]);
  const usedOrigins = [...new Set(CORE_KEYS.map((k) => targets[k]?.origin).filter(Boolean))] as TargetOrigin[];

  return (
    <>
      <PageHeader title="Settings" description="Your profile decides which reference values apply to you." />

      <div className="flex flex-col gap-4">
        <ProfileForm
          // Remount with fresh values after a save.
          key={profile?.updatedAt.toISOString() ?? "new"}
          initial={{
            birthYear: str(profile?.birthYear),
            sex: profile?.sex ?? "",
            heightCm: str(profile?.heightCm),
            weightKg: str(profile?.weightKg),
            activityLevel: profile?.activityLevel ?? "",
            goal: profile?.goal ?? "",
            dietaryPreference: profile?.dietaryPreference ?? "",
            allergies: profile?.allergies ?? [],
            energyTargetKcal: str(profile?.energyTargetKcal),
            proteinTargetG: str(profile?.proteinTargetG),
            carbsTargetG: str(profile?.carbsTargetG),
            fatTargetG: str(profile?.fatTargetG),
            fibreTargetG: str(profile?.fibreTargetG),
          }}
        />

        <Card asSection>
          <CardHeader>
            <CardTitle>Your current targets</CardTitle>
            <CardDescription>
              What each nutrient is measured against, and where the number comes from. Upper levels are shown where
              EFSA has set one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="-mx-5 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pl-5 font-medium sm:pl-0">Nutrient</th>
                    <th scope="col" className="py-2 text-right font-medium">Daily target</th>
                    <th scope="col" className="py-2 pl-4 font-medium">Type</th>
                    <th scope="col" className="py-2 pr-5 text-right font-medium sm:pr-0">Upper level</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {CORE_KEYS.map((key) => {
                    const t = targets[key];
                    if (!t) return null;
                    const def = NUTRIENTS[key];
                    return (
                      <tr key={key}>
                        <th scope="row" className="py-2 pl-5 text-left font-normal sm:pl-0">
                          {def.name}
                          {def.alias ? <span className="ml-1.5 text-xs text-muted-foreground">{def.alias}</span> : null}
                        </th>
                        <td className="py-2 text-right tabular-nums">
                          {t.direction === "limit" ? "≤ " : ""}
                          {formatWithUnit(key, t.amount)}
                        </td>
                        <td className="py-2 pl-4">
                          <Badge>{ORIGIN_LABELS[t.origin].short}</Badge>
                        </td>
                        <td className="py-2 pr-5 text-right text-muted-foreground tabular-nums sm:pr-0">
                          {t.upper
                            ? `${formatWithUnit(key, t.upper.amount)}${
                                t.upper.basis === "supplemental-only"
                                  ? " (supplements only)"
                                  : t.upper.basis !== "total"
                                    ? ` (${t.upper.basis.nutrient === "retinol" ? "retinol" : "folic acid"} only)`
                                    : t.upper.kind === "safe-level"
                                      ? " (safe level)"
                                      : ""
                              }`
                            : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="mt-5 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {usedOrigins.map((o) => (
                <div key={o} className="flex gap-2">
                  <dt className="w-28 shrink-0 font-medium text-foreground">{ORIGIN_LABELS[o].short}</dt>
                  <dd>{ORIGIN_LABELS[o].long}.</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Reference values are for healthy adults and do not cover pregnancy, lactation, children or medical
              conditions. They describe populations, not your individual requirement; a food log cannot diagnose a
              deficiency.
            </p>
          </CardContent>
        </Card>

        <Card asSection>
          <CardHeader>
            <CardTitle>Food data</CardTitle>
            <CardDescription>Where the nutrient values in this app come from.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {sources.map((s) => (
              <div key={s.id}>
                <div className="font-medium">{s.name}</div>
                <div className="text-muted-foreground">
                  {s.publisher} · {s.version} · {s.license} · {formatNumber(s._count.foods)} foods loaded
                </div>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              This release contains no biotin or iodine values, so those two nutrients always show “No data”.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
