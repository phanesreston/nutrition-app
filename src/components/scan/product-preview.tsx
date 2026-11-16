import { ExternalLink, TriangleAlert } from "lucide-react";
import { ProductImage } from "@/components/food/product-image";
import { Badge } from "@/components/ui/badge";
import { MICRO_KEYS, NUTRIENTS, OTHER_KEYS, type NutrientKey } from "@/domain/nutrients/catalog";
import { formatAmount } from "@/lib/format";
import type { FoodView } from "@/server/foods";

const LABEL_ROWS: { key: NutrientKey; label: string; indent?: boolean }[] = [
  { key: "energy", label: "Energy" },
  { key: "fat", label: "Fat" },
  { key: "saturatedFat", label: "of which saturates", indent: true },
  { key: "carbs", label: "Carbohydrate" },
  { key: "sugars", label: "of which sugars", indent: true },
  { key: "fibre", label: "Fibre" },
  { key: "protein", label: "Protein" },
  { key: "sodium", label: "Sodium" },
];

export const OFF_SOURCE_ID = "open-food-facts";

/** Product card shown after a scan, before anything is logged. */
export function ProductPreview({ food, origin, stale }: { food: FoodView; origin?: string; stale?: boolean }) {
  const isOff = food.source.id === OFF_SOURCE_ID;
  // Sodium is shown with the label rows (it comes from the salt figure), not repeated here.
  const micros = [...MICRO_KEYS, ...OTHER_KEYS].filter((k) => k !== "sodium");
  const declared = micros.filter((k) => food.per100g[k] !== undefined);
  const missing = MICRO_KEYS.filter((k) => k !== "sodium" && food.per100g[k] === undefined);
  const noEnergy = food.per100g.energy === undefined;
  const per = `per 100 ${food.amountUnit}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
          <ProductImage src={food.imageUrl} className="size-full object-contain" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-semibold tracking-tight">{food.name}</h2>
          {food.brand ? <p className="text-sm text-muted-foreground">{food.brand}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge>{food.isCustom ? "Your custom food" : isOff ? "Open Food Facts" : food.source.name}</Badge>
            {origin === "cache" ? <Badge>Saved copy</Badge> : null}
            {food.barcode ? <span className="font-mono text-xs text-muted-foreground">{food.barcode}</span> : null}
          </div>
        </div>
      </div>

      {stale ? (
        <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
          Open Food Facts could not be reached, so this is an older saved copy of the product.
        </p>
      ) : null}

      {noEnergy ? (
        <p role="alert" className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
          <span>
            <span className="font-medium">No nutrition values are recorded for this product.</span> Logging it would add
            nothing to your totals. Enter the values from the label instead.
          </span>
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <section aria-label={`Nutrition ${per}`}>
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Nutrition {per}</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {LABEL_ROWS.map((row) => {
                const value = food.per100g[row.key];
                return (
                  <tr key={row.key}>
                    <th scope="row" className={`py-1.5 text-left font-normal ${row.indent ? "pl-3 text-muted-foreground" : ""}`}>
                      {row.label}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {value === undefined ? (
                        <span className="text-muted-foreground">Not stated</span>
                      ) : (
                        `${formatAmount(row.key, value)} ${NUTRIENTS[row.key].unit}`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section aria-label="Vitamins and minerals">
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
            Vitamins and minerals {per} · {declared.length} stated
          </h3>
          {declared.length ? (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {declared.map((key) => (
                  <tr key={key}>
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {NUTRIENTS[key].alias ?? NUTRIENTS[key].name}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatAmount(key, food.per100g[key]!)} {NUTRIENTS[key].unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">None are stated for this product.</p>
          )}
          {missing.length ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Not stated ({missing.length}):</span>{" "}
              {missing.map((k) => NUTRIENTS[k].alias ?? NUTRIENTS[k].name).join(", ")}. These count as unknown, not
              zero — packaged-food labels rarely list them.
            </p>
          ) : null}
        </section>
      </div>

      {food.ingredients ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Ingredients</summary>
          <p className="mt-1.5 leading-relaxed">{food.ingredients}</p>
        </details>
      ) : null}

      {isOff ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Product data from{" "}
          <a
            href={`https://world.openfoodfacts.org/product/${food.barcode ?? food.sourceFoodId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2"
          >
            Open Food Facts <ExternalLink className="size-3" aria-hidden />
          </a>
          , made available under the Open Database License. It is entered by volunteers from product labels, so check
          it against the pack if a figure looks wrong.
        </p>
      ) : null}
    </div>
  );
}
