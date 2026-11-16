"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Decimal from "decimal.js";
import { toast } from "sonner";
import type { Meal } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { gramsForPortion, scalePer100g } from "@/domain/calc/portion";
import { formatGrams, formatNumber } from "@/lib/format";
import { addDiaryEntry, updateDiaryEntry } from "@/server/actions";
import type { FoodView } from "@/server/foods";

const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snacks" },
];

export function mealForNow(now: Date = new Date()): Meal {
  const h = now.getHours();
  if (h < 11) return "BREAKFAST";
  if (h < 15) return "LUNCH";
  if (h < 21) return "DINNER";
  return "SNACK";
}

export interface LogFoodFormProps {
  food: FoodView;
  date: string;
  defaultMeal?: Meal;
  /** When set, the form edits this entry instead of creating one. */
  entry?: { id: string; meal: Meal; quantity: number; unitLabel: string };
  onDone: () => void;
}

const PREVIEW = [
  { key: "energy", label: "Energy", unit: "kcal", decimals: 0 },
  { key: "protein", label: "Protein", unit: "g", decimals: 1 },
  { key: "carbs", label: "Carbs", unit: "g", decimals: 1 },
  { key: "fat", label: "Fat", unit: "g", decimals: 1 },
] as const;

export function LogFoodForm({ food, date, defaultMeal, entry, onDone }: LogFoodFormProps) {
  const id = useId();
  const [pending, startTransition] = useTransition();

  const initialUnit = entry
    ? entry.unitLabel === "g" || entry.unitLabel === "ml"
      ? "g"
      : (food.portions.find((p) => p.label === entry.unitLabel)?.id ?? "g")
    : (food.portions[0]?.id ?? "g");
  const [unit, setUnit] = useState(initialUnit);
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : initialUnit === "g" ? "100" : "1");
  const [meal, setMeal] = useState<Meal>(() => entry?.meal ?? defaultMeal ?? mealForNow());
  const [day, setDay] = useState(date);
  const [error, setError] = useState<string | null>(null);

  const grams = useMemo(() => {
    const q = Number(quantity);
    if (!quantity.trim() || !Number.isFinite(q) || q <= 0) return null;
    const unitGrams = unit === "g" ? 1 : food.portions.find((p) => p.id === unit)?.gramWeight;
    if (!unitGrams) return null;
    return gramsForPortion(new Decimal(quantity), unitGrams);
  }, [quantity, unit, food.portions]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!grams) {
      setError("Enter an amount greater than zero");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = entry
        ? await updateDiaryEntry({ entryId: entry.id, unit, quantity, meal })
        : await addDiaryEntry({ foodId: food.id, date: day, unit, quantity, meal });
      if (result.ok) {
        toast.success(entry ? "Entry updated" : `Added ${food.name}`);
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-[1fr_1.6fr] gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-qty`}>Amount</Label>
          <Input
            id={`${id}-qty`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            autoFocus
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-unit`}>Serving</Label>
          <NativeSelect
            id={`${id}-unit`}
            value={unit}
            onChange={(e) => {
              const next = e.target.value;
              // Switching between grams and a household measure: reset to a sensible amount.
              if ((next === "g") !== (unit === "g")) setQuantity(next === "g" ? "100" : "1");
              setUnit(next);
            }}
          >
            <option value="g">{food.amountUnit === "ml" ? "millilitres" : "grams"}</option>
            {food.portions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({formatGrams(p.gramWeight, food.amountUnit)})
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className={entry ? "" : "grid grid-cols-2 gap-3"}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-meal`}>Meal</Label>
          <NativeSelect id={`${id}-meal`} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEAL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {entry ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-date`}>Day</Label>
            <Input id={`${id}-date`} type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
        )}
      </div>

      <div className="rounded-lg bg-muted/60 p-3">
        <div className="mb-2 text-xs text-muted-foreground">
          {grams ? `This serving · ${formatGrams(grams.toNumber(), food.amountUnit)}` : "Enter an amount to see nutrition"}
        </div>
        <dl className="grid grid-cols-4 gap-2">
          {PREVIEW.map((p) => {
            const value = grams ? scalePer100g(food.per100g[p.key], grams) : null;
            return (
              <div key={p.key}>
                <dt className="text-xs text-muted-foreground">{p.label}</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {value ? `${formatNumber(value.toNumber(), p.decimals)} ${p.unit}` : "–"}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-critical-text">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : entry ? "Save changes" : "Add to diary"}
      </Button>
    </form>
  );
}
