"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, History, ImageOff, ImagePlus, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ProductImage } from "@/components/food/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MINERAL_KEYS, NUTRIENTS, OTHER_KEYS, VITAMIN_KEYS, type NutrientKey } from "@/domain/nutrients/catalog";
import { SODIUM_MG_PER_G_SALT } from "@/domain/nutrients/limits";
import { KJ_PER_KCAL } from "@/domain/nutrients/units";
import { BASE_PATH } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { recalculateFoodDiary, revertFoodChange, saveFoodEdits } from "@/server/admin/actions";
import type { FieldChange } from "@/server/admin/food-admin";
import type { EditorData } from "@/server/admin/queries";

const MACROS: { key: NutrientKey; label: string }[] = [
  { key: "energy", label: "Calories" },
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbohydrates" },
  { key: "fat", label: "Fat" },
  { key: "saturatedFat", label: "Saturated fat" },
  { key: "sugars", label: "Sugar" },
  { key: "fibre", label: "Fibre" },
  { key: "sodium", label: "Sodium" },
];

const ORIGIN_TEXT: Record<string, string> = {
  label: "values declared on the pack (manufacturer-reported), via Open Food Facts",
  reference: "a reference database",
  user: "values a user entered from the label",
};

const STATUS_TEXT = {
  original: "Original",
  corrected: "Corrected",
  estimated: "Estimated",
  unknown: "Unknown",
} as const;

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Trim trailing zeros for display: "12.5000" -> "12.5". */
const tidy = (n: number) => String(Number(n.toFixed(4)));

function StatusBadge({ status, edited }: { status: keyof typeof STATUS_TEXT; edited: boolean }) {
  if (edited) return <Badge className="border-series-1 text-series-1">Unsaved</Badge>;
  return (
    <Badge
      className={cn(
        status === "corrected" && "border-foreground text-foreground",
        status === "estimated" && "border-warning text-warning-text",
        status === "unknown" && "border-dashed",
      )}
    >
      {STATUS_TEXT[status]}
    </Badge>
  );
}

export function FoodEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [working, startWork] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(
    () => Object.fromEntries(Object.entries(data.fields).map(([k, f]) => [k, f.value ?? ""])) as Record<string, string>,
    [data.fields],
  );
  const initialEstimated = useMemo(
    () => Object.fromEntries(Object.entries(data.fields).map(([k, f]) => [k, f.status === "estimated"])) as Record<string, boolean>,
    [data.fields],
  );
  const [values, setValues] = useState(initial);
  const [estimated, setEstimated] = useState(initialEstimated);
  const [image, setImage] = useState(data.image.current);
  const [upload, setUpload] = useState<{ file: File; preview: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const unit = values.amountUnit === "ml" ? "ml" : "g";
  const isEdited = (field: string) => values[field].trim() !== initial[field] || estimated[field] !== initialEstimated[field];
  const editedFields = Object.keys(values).filter(isEdited);
  const imageEdited = upload !== null || image !== data.image.current;
  const dirtyCount = editedFields.length + (imageEdited ? 1 : 0);
  const dirty = dirtyCount > 0;

  // Warn before losing unsaved work: closing/reloading the tab, and in-app links.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.("a[href]");
      if (link && !link.getAttribute("target") && !window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  useEffect(() => () => void (upload && URL.revokeObjectURL(upload.preview)), [upload]);

  const set = (field: string, value: string) => setValues((v) => ({ ...v, [field]: value }));
  const restore = (field: string) => {
    set(field, data.fields[field].original ?? "");
    setEstimated((e) => ({ ...e, [field]: false }));
  };

  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("The image is larger than 8 MB");
      return;
    }
    setUpload({ file, preview: URL.createObjectURL(file) });
    setImage("pending-upload");
  }

  function discard() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setValues(initial);
    setEstimated(initialEstimated);
    setImage(data.image.current);
    setUpload(null);
    setError(null);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const changes: FieldChange[] = [];
      for (const field of editedFields) {
        const value = values[field].trim();
        const f = data.fields[field];
        const backToOriginal = f.status !== "original" && f.status !== "unknown" && value === (f.original ?? "") && !estimated[field];
        changes.push(backToOriginal ? { field, restore: true } : { field, value: value === "" ? null : value, estimated: estimated[field] });
      }

      if (imageEdited) {
        let choice = image;
        if (upload && image === "pending-upload") {
          const body = new FormData();
          body.set("file", upload.file);
          let result: { ok: boolean; imageId?: string; error?: string };
          try {
            const res = await fetch(`${BASE_PATH}/api/admin/foods/${data.food.id}/image`, { method: "POST", body });
            result = await res.json();
          } catch {
            result = { ok: false, error: "The image could not be uploaded. Check your connection and try again." };
          }
          if (!result.ok || !result.imageId) {
            setError(result.error ?? "The image could not be uploaded");
            return;
          }
          choice = `upload:${result.imageId}`;
        }
        changes.push(choice === "source" && data.image.sourceUrl ? { field: "image", restore: true } : { field: "image", value: choice });
      }

      const result = await saveFoodEdits(data.food.id, changes);
      if (result.ok) {
        toast.success(result.changed === 0 ? "Nothing needed changing" : `Saved ${result.changed} ${result.changed === 1 ? "change" : "changes"}`);
        setUpload(null);
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  function revert(auditId: string) {
    if (dirty && !window.confirm("Reverting reloads this page and discards your unsaved changes. Continue?")) return;
    startWork(async () => {
      const result = await revertFoodChange(auditId);
      if (result.ok) {
        toast.success("Change reverted");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function recalculate() {
    const n = data.food.diaryEntries;
    if (!window.confirm(`Update ${n} past diary ${n === 1 ? "entry" : "entries"} to this product's current values? This changes the totals of days already logged and cannot be undone automatically.`)) return;
    startWork(async () => {
      const result = await recalculateFoodDiary(data.food.id);
      if (result.ok) {
        toast.success(`Recalculated ${result.entries} past ${result.entries === 1 ? "entry" : "entries"}`);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  // ---- field rows
  const fieldMeta = (field: string) => {
    const f = data.fields[field];
    const edited = isEdited(field);
    const canRestore = (f.status === "corrected" || f.status === "estimated" || edited) && values[field].trim() !== (f.original ?? "");
    return { f, edited, canRestore };
  };

  const restoreButton = (field: string, label: string) => (
    <Button type="button" variant="ghost" size="icon-sm" title="Restore the imported value" aria-label={`Restore ${label} to the imported value`} onClick={() => restore(field)}>
      <RotateCcw className="text-muted-foreground" />
    </Button>
  );

  const textField = (field: string, label: string, opts: { multiline?: boolean; mono?: boolean; hint?: string } = {}) => {
    const { f, edited, canRestore } = fieldMeta(field);
    const id = `f-${field}`;
    return (
      <div key={field} className={cn("flex flex-col gap-1.5", opts.multiline && "sm:col-span-2")}>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          <span className="flex items-center gap-1">
            <StatusBadge status={f.status} edited={edited} />
            {canRestore ? restoreButton(field, label) : null}
          </span>
        </div>
        {opts.multiline ? (
          <textarea
            id={id}
            rows={3}
            value={values[field]}
            onChange={(e) => set(field, e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-base sm:text-sm"
          />
        ) : (
          <Input id={id} value={values[field]} onChange={(e) => set(field, e.target.value)} className={opts.mono ? "font-mono" : ""} />
        )}
        {f.status !== "original" && f.status !== "unknown" && f.original !== null ? (
          <p className="truncate text-xs text-muted-foreground">Imported: {f.original}</p>
        ) : opts.hint ? (
          <p className="text-xs text-muted-foreground">{opts.hint}</p>
        ) : null}
      </div>
    );
  };

  const numberRow = (field: string, label: string, unitText: string, extra?: React.ReactNode, allowEstimate = true) => {
    const { f, edited, canRestore } = fieldMeta(field);
    const id = `f-${field}`;
    const changed = values[field].trim() !== (f.original ?? "");
    return (
      <div key={field} data-field={field} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_9rem_auto]">
        <Label htmlFor={id} className="min-w-0 font-normal">
          <span className="font-medium">{label}</span>
          {f.original !== null && changed ? <span className="mt-0.5 block text-xs text-muted-foreground">Imported: {f.original} {unitText}</span> : null}
          {extra}
        </Label>
        <div className="relative w-36 sm:w-auto">
          <Input
            id={id}
            inputMode="decimal"
            placeholder="Unknown"
            autoComplete="off"
            value={values[field]}
            onChange={(e) => set(field, e.target.value)}
            className="pr-12 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{unitText}</span>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1 sm:w-52">
          {allowEstimate && changed && values[field].trim() !== "" ? (
            <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={estimated[field]} onChange={(e) => setEstimated((s) => ({ ...s, [field]: e.target.checked }))} />
              Estimate
            </label>
          ) : null}
          <StatusBadge status={f.status} edited={edited} />
          {canRestore ? restoreButton(field, label) : <span className="size-8" aria-hidden />}
        </div>
      </div>
    );
  };

  const nutrientRows = (keys: readonly NutrientKey[]) =>
    keys.map((key) => {
      const def = NUTRIENTS[key];
      return numberRow(`n:${key}`, def.alias ? `${def.name} · ${def.alias}` : def.name, def.unit);
    });

  // Salt is a second view of sodium (salt = sodium × 2.5); only sodium is stored.
  const sodium = values["n:sodium"].trim();
  const salt = sodium !== "" && Number.isFinite(Number(sodium)) ? tidy(Number(sodium) / SODIUM_MG_PER_G_SALT) : "";
  const kcal = values["n:energy"].trim();
  const kj = kcal !== "" && Number.isFinite(Number(kcal)) ? Math.round(Number(kcal) * KJ_PER_KCAL.toNumber()) : null;

  const imageOptions: { id: string; label: string; src: string | null; note?: string }[] = [
    ...(upload ? [{ id: "pending-upload", label: "New photo", src: upload.preview, note: "Not saved yet" }] : []),
    ...data.image.uploads.map((u, i) => ({ id: `upload:${u.id}`, label: i === 0 ? "Latest upload" : "Earlier upload", src: u.url, note: dateTime(u.createdAt) })),
    ...(data.image.sourceUrl ? [{ id: "source", label: "Original image", src: data.image.sourceUrl, note: "Open Food Facts" }] : []),
    { id: "none", label: "No photograph", src: null },
  ];
  const selectedImage = imageOptions.find((o) => o.id === image) ?? imageOptions.at(-1)!;

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{data.food.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Badge>{data.food.sourceName}</Badge>
            {data.food.isCustom ? <Badge>Custom food</Badge> : null}
            <span>Imported {dateTime(data.food.fetchedAt ?? data.food.createdAt)}</span>
            {data.food.editedAt ? <span>· Edited {dateTime(data.food.editedAt)}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/foods/${data.food.id}`}>View product page</Link>
          </Button>
          {data.food.sourceId === "open-food-facts" ? (
            <Button asChild variant="outline" size="sm">
              <a href={`https://world.openfoodfacts.org/product/${data.food.sourceFoodId}`} target="_blank" rel="noreferrer">
                Open Food Facts <ExternalLink />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        Imported values for this product are {ORIGIN_TEXT[data.food.sourceOrigin] ?? "from its source"}. Anything you
        change is stored as a correction on top of the imported record: it wins over future imports and scans, and can
        be restored to the imported value at any time. Leave a nutrient empty for <span className="font-medium text-foreground">unknown</span>;
        enter <span className="font-medium text-foreground">0</span> only when the product really contains none.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card asSection>
            <CardHeader>
              <CardTitle>Product information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {textField("name", "Product name")}
              {textField("brand", "Brand")}
              {textField("barcode", "Barcode", { mono: true, hint: "EAN-13, EAN-8 or UPC, digits only" })}
              {textField("category", "Category")}
              {textField("description", "Description", { multiline: true })}
              {textField("ingredients", "Ingredients", { multiline: true })}
            </CardContent>
          </Card>

          <Card asSection>
            <CardHeader>
              <CardTitle>Serving</CardTitle>
              <CardDescription>Nutrition is stored per 100 {unit}; servings only set the sizes offered when logging.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y pt-2 sm:pt-2">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_9rem_auto]">
                <Label htmlFor="f-amountUnit" className="font-medium">
                  Serving unit
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Values and amounts are per 100 of this unit</span>
                </Label>
                <NativeSelect id="f-amountUnit" value={unit} onChange={(e) => set("amountUnit", e.target.value)} className="w-36 sm:w-full">
                  <option value="g">grams (g)</option>
                  <option value="ml">millilitres (ml)</option>
                </NativeSelect>
                <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1 sm:w-52">
                  <StatusBadge status={data.fields.amountUnit.status} edited={isEdited("amountUnit")} />
                  {fieldMeta("amountUnit").canRestore ? restoreButton("amountUnit", "Serving unit") : <span className="size-8" aria-hidden />}
                </div>
              </div>
              {numberRow("servingSize", "Serving size", unit, undefined, false)}
              {numberRow("packageQuantity", "Package quantity", unit, undefined, false)}
            </CardContent>
          </Card>

          <Card asSection>
            <CardHeader>
              <CardTitle>Macronutrients</CardTitle>
              <CardDescription>Per 100 {unit}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y pt-2 sm:pt-2">
              {MACROS.map((m) =>
                numberRow(
                  `n:${m.key}`,
                  m.label,
                  NUTRIENTS[m.key].unit,
                  m.key === "energy" && kj !== null ? <span className="mt-0.5 block text-xs text-muted-foreground">= {kj} kJ</span> : undefined,
                ),
              )}
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_9rem_auto]">
                <Label htmlFor="f-salt" className="font-normal">
                  <span className="font-medium">Salt</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Linked to sodium: salt = sodium × 2.5</span>
                </Label>
                <div className="relative w-36 sm:w-auto">
                  <Input
                    id="f-salt"
                    inputMode="decimal"
                    placeholder="Unknown"
                    autoComplete="off"
                    value={salt}
                    onChange={(e) => {
                      const text = e.target.value.trim().replace(",", ".");
                      set("n:sodium", text === "" ? "" : Number.isFinite(Number(text)) ? tidy(Number(text) * SODIUM_MG_PER_G_SALT) : values["n:sodium"]);
                    }}
                    className="pr-12 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">g</span>
                </div>
                <span className="hidden sm:block sm:w-52" aria-hidden />
              </div>
            </CardContent>
          </Card>

          {(
            [
              ["Vitamins", VITAMIN_KEYS],
              ["Minerals", MINERAL_KEYS.filter((k) => k !== "sodium")],
              ["Other nutrients", [...OTHER_KEYS, "retinol", "folicAcid"] as NutrientKey[]],
            ] as const
          ).map(([title, keys]) => (
            <Card asSection key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Per 100 {unit}</CardDescription>
              </CardHeader>
              <CardContent className="divide-y pt-2 sm:pt-2">{nutrientRows(keys)}</CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Card asSection>
            <CardHeader>
              <CardTitle>Photograph</CardTitle>
              <CardDescription>Choose which picture the product uses, or upload a new one.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-white">
                {selectedImage.src ? (
                  selectedImage.id === "pending-upload" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedImage.src} alt="Preview of the new photograph" className="size-full object-contain" />
                  ) : (
                    <ProductImage key={selectedImage.src} src={selectedImage.src} className="size-full object-contain" />
                  )
                ) : (
                  <span className="flex flex-col items-center gap-2 text-sm text-neutral-400">
                    <ImageOff className="size-8" aria-hidden /> No photograph
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{selectedImage.label}</span>
                  {selectedImage.note ? <span className="text-muted-foreground"> · {selectedImage.note}</span> : null}
                </span>
                <StatusBadge status={data.image.status} edited={imageEdited} />
              </div>

              <div role="radiogroup" aria-label="Preferred photograph" className="grid grid-cols-4 gap-2">
                {imageOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={image === option.id}
                    aria-label={option.note ? `${option.label}, ${option.note}` : option.label}
                    title={option.note ? `${option.label} · ${option.note}` : option.label}
                    onClick={() => setImage(option.id)}
                    className={cn(
                      "flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-white",
                      image === option.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "opacity-80 hover:opacity-100",
                    )}
                  >
                    {option.src ? (
                      option.id === "pending-upload" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={option.src} alt="" className="size-full object-contain" />
                      ) : (
                        <ProductImage src={option.src} className="size-full object-contain" />
                      )
                    ) : (
                      <ImageOff className="size-4 text-neutral-400" aria-hidden />
                    )}
                  </button>
                ))}
              </div>

              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload a photograph"
                onChange={(e) => {
                  chooseFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <ImagePlus /> {upload ? "Choose a different photo" : "Upload a photo"}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                JPG, PNG or WebP, up to 8 MB. Photos are resized and location data is removed. Earlier uploads stay
                here so you can switch back.
              </p>
            </CardContent>
          </Card>

          <Card asSection>
            <CardHeader>
              <CardTitle>Past diary entries</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                {data.food.diaryEntries === 0
                  ? "This product has not been logged yet."
                  : `Logged ${data.food.diaryEntries} ${data.food.diaryEntries === 1 ? "time" : "times"}. Those entries keep the values they were logged with; corrections apply to new entries only.`}
              </p>
              {data.food.diaryEntries > 0 ? (
                <Button type="button" variant="outline" disabled={working || dirty} onClick={recalculate}>
                  Recalculate past entries
                </Button>
              ) : null}
              {data.food.diaryEntries > 0 && dirty ? <p className="text-xs text-muted-foreground">Save your changes first.</p> : null}
            </CardContent>
          </Card>

          <Card asSection>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" aria-hidden /> Edit history
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-3">
              {data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes have been made to this product.</p>
              ) : (
                <ol className="divide-y text-sm">
                  {data.history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {h.label}
                          {h.action !== "edit" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">({h.action})</span> : null}
                        </div>
                        {h.action === "recalculate" ? (
                          <div className="text-muted-foreground">{h.newValue}</div>
                        ) : (
                          <div className="break-words text-muted-foreground">
                            <span className="line-through decoration-muted-foreground/50">{h.oldValue ?? "none"}</span>
                            {" → "}
                            <span className="text-foreground">{h.newValue ?? "none"}</span>
                          </div>
                        )}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {h.admin} · {dateTime(h.createdAt)}
                        </div>
                      </div>
                      {h.revertible ? (
                        <Button type="button" variant="ghost" size="icon-sm" disabled={working} title="Revert this change" aria-label={`Revert change to ${h.label}`} onClick={() => revert(h.id)}>
                          <Undo2 className="text-muted-foreground" />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save bar: always reachable, above the tab bar on phones. */}
      <div className="fixed inset-x-0 bottom-14 z-20 border-t bg-background/95 backdrop-blur lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p role="status" className={cn("min-w-0 truncate text-sm", error ? "text-critical-text" : "text-muted-foreground")}>
            {error ?? (dirty ? `${dirtyCount} unsaved ${dirtyCount === 1 ? "change" : "changes"}` : "No unsaved changes")}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={discard}>
              Cancel
            </Button>
            <Button type="button" disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
