"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MINERAL_KEYS, NUTRIENTS, OTHER_KEYS, VITAMIN_KEYS, type NutrientKey } from "@/domain/nutrients/catalog";
import { saveCustomFood } from "@/server/actions";

/** Label order used on EU packs; sodium is entered as salt. */
const MAIN_FIELDS: { key: NutrientKey; label: string; required?: boolean }[] = [
  { key: "energy", label: "Energy", required: true },
  { key: "fat", label: "Fat" },
  { key: "saturatedFat", label: "of which saturates" },
  { key: "carbs", label: "Carbohydrate" },
  { key: "sugars", label: "of which sugars" },
  { key: "fibre", label: "Fibre" },
  { key: "protein", label: "Protein" },
];

const MICRO_FIELDS = [...VITAMIN_KEYS, ...MINERAL_KEYS, ...OTHER_KEYS].filter((k) => k !== "sodium");

export interface CustomFoodFormProps {
  barcode?: string;
  initialName?: string;
  initialBrand?: string;
  onSaved: (foodId: string) => void;
  onCancel?: () => void;
}

/** Enter a food from its label. Blank fields are stored as unknown, never as zero. */
export function CustomFoodForm({ barcode, initialName = "", initialBrand = "", onSaved, onCancel }: CustomFoodFormProps) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState(initialBrand);
  const [amountUnit, setAmountUnit] = useState<"g" | "ml">("g");
  const [servingSize, setServingSize] = useState("");
  const [salt, setSalt] = useState("");
  const [nutrients, setNutrients] = useState<Record<string, string>>({});

  const setNutrient = (key: string, value: string) => setNutrients((n) => ({ ...n, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveCustomFood({ name, brand, barcode, amountUnit, servingSize, saltG: salt, nutrients });
      if (result.ok) onSaved(result.foodId);
      else setError(result.error);
    });
  }

  const numberField = (key: string, label: string, unit: string, value: string, onChange: (v: string) => void, required = false) => (
    <div key={key} className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>
        {label} <span className="font-normal text-muted-foreground">({unit})</span>
      </Label>
      <Input
        id={`${id}-${key}`}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        required={required}
        placeholder={required ? "" : "Not stated"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {barcode ? (
        <p className="text-sm text-muted-foreground">
          Barcode <span className="font-mono text-foreground">{barcode}</span> — scanning it again will find this food.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-name`}>Product name</Label>
          <Input id={`${id}-name`} required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-brand`}>
            Brand <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id={`${id}-brand`} maxLength={100} value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-unit`}>Values are per</Label>
            <NativeSelect id={`${id}-unit`} value={amountUnit} onChange={(e) => setAmountUnit(e.target.value as "g" | "ml")}>
              <option value="g">100 g</option>
              <option value="ml">100 ml</option>
            </NativeSelect>
          </div>
          {numberField("serving", "Serving", amountUnit, servingSize, setServingSize)}
        </div>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Nutrition per 100 {amountUnit}</legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Copy the figures from the pack. Leave a field empty if the label does not state it: empty means unknown, not
          zero.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MAIN_FIELDS.map((f) =>
            numberField(f.key, f.label, NUTRIENTS[f.key].unit, nutrients[f.key] ?? "", (v) => setNutrient(f.key, v), f.required),
          )}
          {numberField("salt", "Salt", "g", salt, setSalt)}
        </div>
      </fieldset>

      <details>
        <summary className="cursor-pointer text-sm font-semibold">Vitamins and minerals (optional)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MICRO_FIELDS.map((key) =>
            numberField(
              key,
              NUTRIENTS[key].alias ? `${NUTRIENTS[key].name} ${NUTRIENTS[key].alias}` : NUTRIENTS[key].name,
              NUTRIENTS[key].unit,
              nutrients[key] ?? "",
              (v) => setNutrient(key, v),
            ),
          )}
        </div>
      </details>

      {error ? (
        <p role="alert" className="text-sm text-critical-text">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save food"}
        </Button>
        {onCancel ? (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
