import type { Metadata } from "next";
import Link from "next/link";
import { AddFoodDialog } from "@/components/food/add-food-dialog";
import { EntryActions } from "@/components/food/entry-actions";
import { DateNav } from "@/components/date-nav";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getSelectedDay } from "@/server/request";
import { formatGrams, formatNumber } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { MEALS, MEAL_LABELS, getDayView } from "@/server/day";
import { getFoodsByIds } from "@/server/foods";

export const metadata: Metadata = { title: "Food Diary" };

const fmt = (v: number | null, decimals = 0) => (v === null ? "–" : formatNumber(v, decimals));

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date, today } = await getSelectedDay(searchParams);
  const user = await getCurrentUser();
  const day = await getDayView(user.id, date);
  const foods = await getFoodsByIds([...new Set(day.entries.map((e) => e.foodId))]);
  const n = day.nutrients;

  const totals = [
    { label: "Energy", value: `${formatNumber(n.energy.consumed)}`, unit: "kcal" },
    { label: "Protein", value: formatNumber(n.protein.consumed, 1), unit: "g" },
    { label: "Carbs", value: formatNumber(n.carbs.consumed, 1), unit: "g" },
    { label: "Fat", value: formatNumber(n.fat.consumed, 1), unit: "g" },
  ];

  return (
    <>
      <PageHeader title="Food Diary" description="Everything you ate, meal by meal.">
        <DateNav date={date} today={today} />
        <AddFoodDialog date={date} />
      </PageHeader>

      <Card className="mb-4">
        <dl className="grid grid-cols-4 divide-x">
          {totals.map((t) => (
            <div key={t.label} className="px-3 py-4 text-center sm:px-5">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums sm:text-xl">
                {t.value} <span className="text-xs font-normal text-muted-foreground">{t.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="flex flex-col gap-4">
        {MEALS.map((meal) => {
          const entries = day.entries.filter((e) => e.meal === meal);
          return (
            <Card key={meal} asSection aria-labelledby={`meal-${meal}`}>
              <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
                <div className="flex items-baseline gap-3">
                  <h2 id={`meal-${meal}`} className="text-[15px] font-semibold tracking-tight">
                    {MEAL_LABELS[meal]}
                  </h2>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {entries.length ? `${formatNumber(day.mealEnergy[meal])} kcal` : ""}
                  </span>
                </div>
                <AddFoodDialog date={date} meal={meal} label="Add" variant="ghost" size="sm" />
              </div>
              {entries.length === 0 ? (
                <p className="border-t px-5 py-4 text-sm text-muted-foreground sm:px-6">Nothing logged.</p>
              ) : (
                <ul className="divide-y border-t">
                  {entries.map((entry) => {
                    const food = foods.get(entry.foodId);
                    return (
                      <li key={entry.id} className="flex items-center gap-3 py-2.5 pr-2 pl-5 sm:pr-4 sm:pl-6">
                        <div className="min-w-0 flex-1">
                          <Link href={`/foods/${entry.foodId}`} className="block truncate text-sm font-medium hover:underline">
                            {entry.foodName}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground tabular-nums">
                            {entry.unitLabel === "g" || entry.unitLabel === "ml"
                              ? formatGrams(entry.grams, entry.amountUnit)
                              : `${formatNumber(entry.quantity, 2)} × ${entry.unitLabel} · ${formatGrams(entry.grams, entry.amountUnit)}`}
                          </div>
                        </div>
                        <dl className="hidden shrink-0 gap-5 text-right text-xs text-muted-foreground tabular-nums md:flex">
                          {(
                            [
                              ["P", entry.protein],
                              ["C", entry.carbs],
                              ["F", entry.fat],
                            ] as const
                          ).map(([label, value]) => (
                            <div key={label} className="w-12">
                              <dt className="sr-only">{label === "P" ? "Protein" : label === "C" ? "Carbohydrate" : "Fat"}</dt>
                              <dd>
                                {label} {fmt(value, 1)} g
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">
                          {fmt(entry.energy)} <span className="text-xs font-normal text-muted-foreground">kcal</span>
                        </div>
                        {food ? <EntryActions entry={entry} food={food} date={date} /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
