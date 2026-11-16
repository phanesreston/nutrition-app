import Link from "next/link";
import { ArrowRight, Check, CircleAlert, CircleDashed, Minus } from "lucide-react";
import { AddFoodDialog } from "@/components/food/add-food-dialog";
import { MealEnergyChart } from "@/components/charts/meal-energy-chart";
import { DateNav } from "@/components/date-nav";
import { Meter } from "@/components/nutrients/meter";
import { NutrientRow } from "@/components/nutrients/nutrient-row";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MICRO_KEYS, MINERAL_KEYS, VITAMIN_KEYS } from "@/domain/nutrients/catalog";
import { ORIGIN_LABELS } from "@/domain/reference/targets";
import { getSelectedDay } from "@/server/request";
import { formatNumber, formatPercent } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { MEALS, MEAL_LABELS, getDayView, type DayView } from "@/server/day";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date, today } = await getSelectedDay(searchParams);
  const user = await getCurrentUser();
  const day = await getDayView(user.id, date);
  const query = date === today ? "" : `?date=${date}`;
  const empty = day.entries.length === 0;

  return (
    <>
      <PageHeader title="Dashboard" description="Your nutrition for the day, from calories down to trace minerals.">
        <DateNav date={date} today={today} />
        <AddFoodDialog date={date} />
      </PageHeader>

      {empty ? (
        <Card className="mb-4 border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Nothing logged for this day yet</p>
              <p className="text-sm text-muted-foreground">
                Add a food and every bar below updates with its vitamins and minerals.
              </p>
            </div>
            <AddFoodDialog date={date} label="Log your first food" variant="secondary" />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <EnergyCard day={day} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Macronutrients</CardTitle>
            <CardDescription>Consumed against your daily targets</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {(["protein", "carbs", "fat", "fibre"] as const).map((key) => (
              <NutrientRow key={key} view={day.nutrients[key]} />
            ))}
          </CardContent>
        </Card>

        <SummaryCard day={day} href={`/nutrients${query}`} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Energy by meal</CardTitle>
            <CardDescription>
              Kilocalories logged per meal ·{" "}
              <Link href={`/diary${query}`} className="underline underline-offset-4 hover:text-foreground">
                open diary
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MealEnergyChart
              data={MEALS.map((meal) => ({
                meal: MEAL_LABELS[meal],
                kcal: Math.round(day.mealEnergy[meal]),
                items: day.entries.filter((e) => e.meal === meal).length,
              }))}
            />
          </CardContent>
        </Card>

        <MicroCard title="Vitamins" keys={VITAMIN_KEYS} day={day} className="lg:col-span-3" />
        <MicroCard title="Minerals" keys={MINERAL_KEYS} day={day} className="lg:col-span-3" />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Targets are EFSA dietary reference values for healthy adults unless marked otherwise. Intake figures are
        estimates from food composition data and are not a medical assessment.
      </p>
    </>
  );
}

function EnergyCard({ day }: { day: DayView }) {
  const energy = day.nutrients.energy;
  const target = energy.target!;
  const diff = target.amount - energy.consumed;
  const split = day.energySplit;
  const parts = [
    { label: "Protein", value: split?.protein ?? 0, color: "bg-series-1" },
    { label: "Carbs", value: split?.carbs ?? 0, color: "bg-series-2" },
    { label: "Fat", value: split?.fat ?? 0, color: "bg-series-3" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy</CardTitle>
        <CardDescription>
          Target {formatNumber(target.amount)} kcal · {ORIGIN_LABELS[target.origin].short.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatNumber(energy.consumed)}</span>
            <span className="text-sm text-muted-foreground">kcal eaten</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {diff >= 0 ? `${formatNumber(diff)} kcal remaining` : `${formatNumber(-diff)} kcal over target`}
          </p>
        </div>
        <Meter fraction={energy.fraction} status="below" label="Energy" className="h-2.5" />
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Where the energy came from</div>
          {split ? (
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {parts.map((p) => (
                <div key={p.label} className={`${p.color} h-full rounded-[2px]`} style={{ width: `${p.value * 100}%` }} />
              ))}
            </div>
          ) : (
            <div className="h-2 rounded-full bg-track" aria-hidden />
          )}
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-[2px] ${p.color}`} aria-hidden />
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-medium tabular-nums">{split ? formatPercent(p.value) : "–"}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ day, href }: { day: DayView; href: string }) {
  const views = MICRO_KEYS.map((k) => day.nutrients[k]);
  const count = (...statuses: string[]) => views.filter((v) => statuses.includes(v.status)).length;
  const tiles = [
    { label: "Targets met", value: count("met", "within"), icon: Check, tone: "text-good-text" },
    { label: "Below target", value: count("below"), icon: Minus, tone: "text-muted-foreground" },
    { label: "Near or above a limit", value: count("near-upper", "over"), icon: CircleAlert, tone: "text-critical-text" },
    { label: "No data available", value: count("no-data"), icon: CircleDashed, tone: "text-muted-foreground" },
  ];
  const logged = day.entries.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Micronutrients</CardTitle>
        <CardDescription>{views.length} vitamins and minerals tracked</CardDescription>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-4.5rem)] flex-col justify-between gap-4">
        <ul className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <li key={t.label} className="rounded-lg bg-muted/60 p-3">
              <div className="flex items-center gap-1.5">
                <t.icon className={`size-4 ${t.tone}`} aria-hidden />
                <span className="text-2xl font-semibold tabular-nums">{logged ? t.value : "–"}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t.label}</div>
            </li>
          ))}
        </ul>
        <Link href={href} className="flex items-center gap-1 text-sm font-medium hover:underline">
          See every nutrient in detail <ArrowRight className="size-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

function MicroCard({
  title,
  keys,
  day,
  className,
}: {
  title: string;
  keys: readonly (typeof MICRO_KEYS)[number][];
  day: DayView;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Amount consumed / daily reference, and share of the reference reached</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-10 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {keys.map((key) => (
          <NutrientRow key={key} view={day.nutrients[key]} />
        ))}
      </CardContent>
    </Card>
  );
}
