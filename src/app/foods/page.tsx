import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { AddFoodDialog } from "@/components/food/add-food-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getToday } from "@/server/request";
import { formatNumber } from "@/lib/format";
import { countFoods, searchFoods } from "@/server/foods";

export const metadata: Metadata = { title: "Food Search" };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 100).trim() ?? "";
  const [foods, total] = await Promise.all([searchFoods(q, 40), countFoods()]);
  const today = await getToday();

  return (
    <>
      <PageHeader
        title="Food Search"
        description={`${formatNumber(total)} foods from USDA SR Legacy. Values are per 100 g of edible portion.`}
      />

      <Form action="/foods" role="search" className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search foods, e.g. lentils, almonds, yogurt"
            aria-label="Search foods"
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </Form>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {q
          ? `${foods.length === 40 ? "First 40" : foods.length} result${foods.length === 1 ? "" : "s"} for “${q}”`
          : "Browse A–Z, or search by name."}
      </p>

      {foods.length === 0 ? (
        <Card className="border-dashed bg-transparent p-8 text-center shadow-none">
          <p className="font-medium">No foods match “{q}”</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The seed database is a curated subset. Try a simpler term such as “rice” or “chicken”.
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {foods.map((food) => (
              <li key={food.id} className="flex items-center gap-3 py-3 pr-3 pl-5 sm:pr-4 sm:pl-6">
                <div className="min-w-0 flex-1">
                  <Link href={`/foods/${food.id}`} className="block truncate text-sm font-medium hover:underline">
                    {food.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span>{food.per100g.energy !== undefined ? `${formatNumber(food.per100g.energy)} kcal` : "– kcal"}</span>
                    <span className="hidden sm:inline">
                      P {food.per100g.protein !== undefined ? formatNumber(food.per100g.protein, 1) : "–"} · C{" "}
                      {food.per100g.carbs !== undefined ? formatNumber(food.per100g.carbs, 1) : "–"} · F{" "}
                      {food.per100g.fat !== undefined ? formatNumber(food.per100g.fat, 1) : "–"} g
                    </span>
                    <span className="hidden truncate md:inline">{food.category}</span>
                  </div>
                </div>
                <Badge className="hidden sm:inline-flex" title="Core nutrients with a value in the source database">
                  {food.completeness.known}/{food.completeness.total} nutrients
                </Badge>
                <AddFoodDialog date={today} food={food} label="Add" variant="outline" size="sm" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
