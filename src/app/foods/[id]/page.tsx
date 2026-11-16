import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AddFoodDialog } from "@/components/food/add-food-dialog";
import { ProductImage } from "@/components/food/product-image";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MACRO_KEYS,
  MINERAL_KEYS,
  NUTRIENTS,
  OTHER_KEYS,
  VITAMIN_KEYS,
  type NutrientKey,
} from "@/domain/nutrients/catalog";
import { getToday } from "@/server/request";
import { formatAmount, formatGrams, formatPercent } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { getFood, type FoodView } from "@/server/foods";
import { getTargets } from "@/server/profile";
import type { Targets } from "@/domain/reference/targets";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const food = await getFood(id, user.id);
  return { title: food?.name ?? "Food" };
}

export default async function FoodPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const food = await getFood(id, user.id);
  if (!food) notFound();
  const today = await getToday();
  const targets = await getTargets(user.id);
  const isUsda = food.source.id.startsWith("usda");
  const isOff = food.source.id === "open-food-facts";
  const otherKeys = OTHER_KEYS.filter((k) => food.per100g[k] !== undefined);

  return (
    <>
      <Link href="/foods" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Food search
      </Link>
      <PageHeader title={food.name} description={[food.brand, food.category].filter(Boolean).join(" · ") || undefined}>
        <AddFoodDialog date={today} food={food} label="Add to diary" />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <NutrientTable title="Energy and macronutrients" keys={[...MACRO_KEYS, "sugars", "saturatedFat"]} food={food} targets={targets} />
          <NutrientTable title="Vitamins" keys={VITAMIN_KEYS} food={food} targets={targets} />
          <NutrientTable title="Minerals" keys={MINERAL_KEYS} food={food} targets={targets} />
          {otherKeys.length ? <NutrientTable title="Other nutrients" keys={otherKeys} food={food} targets={targets} /> : null}
          {food.ingredients ? (
            <Card>
              <CardHeader>
                <CardTitle>Ingredients</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">{food.ingredients}</CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {food.imageUrl ? (
            <Card className="flex items-center justify-center overflow-hidden bg-white p-4">
              <ProductImage src={food.imageUrl} className="max-h-48 object-contain" />
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Serving sizes</CardTitle>
            </CardHeader>
            <CardContent>
              {food.portions.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {food.portions.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span>{p.label}</span>
                      <span className="text-muted-foreground tabular-nums">{formatGrams(p.gramWeight, food.amountUnit)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No serving size is recorded. Log this food in {food.amountUnit === "ml" ? "millilitres" : "grams"}.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data source</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <dl className="flex flex-col gap-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Database</dt>
                  <dd>{food.source.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Release</dt>
                  <dd>{food.source.version}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{isUsda ? "FDC ID" : food.barcode ? "Barcode" : "Source ID"}</dt>
                  <dd className="font-mono text-[13px] break-all">{food.barcode ?? food.sourceFoodId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Licence</dt>
                  <dd>{food.source.license}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Completeness</dt>
                  <dd>
                    {food.completeness.known} of {food.completeness.total} core nutrients have a value
                  </dd>
                </div>
              </dl>
              {food.completeness.missing.length ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  No value for: {food.completeness.missing.map((k) => NUTRIENTS[k].alias ?? NUTRIENTS[k].name).join(", ")}.
                  Missing values are treated as unknown, not zero.
                </p>
              ) : null}
              {isOff ? (
                <a
                  href={`https://world.openfoodfacts.org/product/${food.barcode ?? food.sourceFoodId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  View on Open Food Facts <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              {isUsda ? (
                <a
                  href={`https://fdc.nal.usda.gov/food-details/${food.sourceFoodId}/nutrients`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  View on FoodData Central <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function NutrientTable({
  title,
  keys,
  food,
  targets,
}: {
  title: string;
  keys: readonly NutrientKey[];
  food: FoodView;
  targets: Targets;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Per 100 {food.amountUnit}, with the share of your daily reference</CardDescription>
      </CardHeader>
      <CardContent className="pt-3 sm:pt-3">
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Nutrient</th>
              <th scope="col">Amount per 100 {food.amountUnit}</th>
              <th scope="col">Share of daily reference</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.map((key) => {
              const def = NUTRIENTS[key];
              const value = food.per100g[key];
              const target = targets[key];
              return (
                <tr key={key}>
                  <th scope="row" className="py-2 text-left font-normal">
                    {def.name}
                    {def.alias ? <span className="ml-1.5 text-xs text-muted-foreground">{def.alias}</span> : null}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {value === undefined ? (
                      <span className="text-muted-foreground">No data</span>
                    ) : (
                      <>
                        {formatAmount(key, value)} <span className="text-muted-foreground">{def.unit}</span>
                      </>
                    )}
                  </td>
                  <td className="w-16 py-2 text-right text-muted-foreground tabular-nums">
                    {value !== undefined && target ? formatPercent(value / target.amount) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
