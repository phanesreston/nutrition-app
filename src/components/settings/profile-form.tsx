"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveProfile, type ProfileInput } from "@/server/actions";

export type ProfileFormValues = {
  birthYear: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  goal: string;
  dietaryPreference: string;
  allergies: string[];
  energyTargetKcal: string;
  proteinTargetG: string;
  carbsTargetG: string;
  fatTargetG: string;
  fibreTargetG: string;
};

const ALLERGENS = [
  ["gluten", "Gluten"],
  ["milk", "Milk"],
  ["egg", "Egg"],
  ["peanut", "Peanut"],
  ["tree-nut", "Tree nuts"],
  ["soy", "Soy"],
  ["fish", "Fish"],
  ["shellfish", "Shellfish"],
  ["sesame", "Sesame"],
] as const;

function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bind = (name: Exclude<keyof ProfileFormValues, "allergies">) => ({
    id: `profile-${name}`,
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveProfile(values as unknown as ProfileInput);
      if (result.ok) toast.success("Profile saved — targets updated");
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>
            Used to choose the right reference values and estimate your energy needs. Every field is optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Year of birth" htmlFor="profile-birthYear" hint="Reference values cover adults (18+).">
            <Input type="number" inputMode="numeric" placeholder="e.g. 1990" {...bind("birthYear")} />
          </Field>
          <Field label="Sex" htmlFor="profile-sex" hint="Several reference values differ by sex.">
            <NativeSelect {...bind("sex")}>
              <option value="">Not specified</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </NativeSelect>
          </Field>
          <Field label="Height (cm)" htmlFor="profile-heightCm">
            <Input type="number" inputMode="decimal" step="0.1" placeholder="e.g. 172" {...bind("heightCm")} />
          </Field>
          <Field label="Weight (kg)" htmlFor="profile-weightKg">
            <Input type="number" inputMode="decimal" step="0.1" placeholder="e.g. 68" {...bind("weightKg")} />
          </Field>
          <Field label="Activity level" htmlFor="profile-activityLevel">
            <NativeSelect {...bind("activityLevel")}>
              <option value="">Not specified</option>
              <option value="SEDENTARY">Sedentary — little or no exercise</option>
              <option value="LIGHT">Light — exercise 1–3 days a week</option>
              <option value="MODERATE">Moderate — exercise 3–5 days a week</option>
              <option value="ACTIVE">Active — exercise 6–7 days a week</option>
              <option value="VERY_ACTIVE">Very active — physical job or twice-daily training</option>
            </NativeSelect>
          </Field>
          <Field label="Goal" htmlFor="profile-goal">
            <NativeSelect {...bind("goal")}>
              <option value="">Not specified</option>
              <option value="LOSE">Lose weight</option>
              <option value="MAINTAIN">Maintain weight</option>
              <option value="GAIN">Gain weight</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your own targets</CardTitle>
          <CardDescription>
            Leave a field empty to use the computed reference value. Anything you enter here is labelled “Your goal”.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Field label="Energy (kcal)" htmlFor="profile-energyTargetKcal">
            <Input type="number" inputMode="numeric" placeholder="Auto" {...bind("energyTargetKcal")} />
          </Field>
          <Field label="Protein (g)" htmlFor="profile-proteinTargetG">
            <Input type="number" inputMode="decimal" placeholder="Auto" {...bind("proteinTargetG")} />
          </Field>
          <Field label="Carbohydrate (g)" htmlFor="profile-carbsTargetG">
            <Input type="number" inputMode="decimal" placeholder="Auto" {...bind("carbsTargetG")} />
          </Field>
          <Field label="Fat (g)" htmlFor="profile-fatTargetG">
            <Input type="number" inputMode="decimal" placeholder="Auto" {...bind("fatTargetG")} />
          </Field>
          <Field label="Fibre (g)" htmlFor="profile-fibreTargetG">
            <Input type="number" inputMode="decimal" placeholder="Auto" {...bind("fibreTargetG")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dietary preferences</CardTitle>
          <CardDescription>Saved now; food recommendations will respect these once that feature is built.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-3">
          <Field label="Diet" htmlFor="profile-dietaryPreference">
            <NativeSelect {...bind("dietaryPreference")}>
              <option value="">Not specified</option>
              <option value="omnivore">Omnivore</option>
              <option value="pescatarian">Pescatarian</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
            </NativeSelect>
          </Field>
          <fieldset className="lg:col-span-2">
            <legend className="mb-2 text-sm font-medium">Allergies and intolerances</legend>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map(([value, label]) => {
                const checked = values.allergies.includes(value);
                return (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-checked:border-foreground has-checked:bg-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setValues((v) => ({
                          ...v,
                          allergies: checked ? v.allergies.filter((a) => a !== value) : [...v.allergies, value],
                        }))
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-critical-text">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
