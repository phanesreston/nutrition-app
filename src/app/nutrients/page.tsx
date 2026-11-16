import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { COVERAGE_AXIS_MAX } from "@/components/charts/coverage";
import { CoverageChart } from "@/components/charts/coverage-chart";
import { DateNav } from "@/components/date-nav";
import { Meter } from "@/components/nutrients/meter";
import { STATUS_META } from "@/components/nutrients/status-meta";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MICRO_KEYS, MINERAL_KEYS, NUTRIENTS, VITAMIN_KEYS, type NutrientKey } from "@/domain/nutrients/catalog";
import { ORIGIN_LABELS } from "@/domain/reference/targets";
import { getSelectedDay } from "@/server/request";
import { formatAmount, formatPercent, formatWithUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { getDayView, type NutrientView } from "@/server/day";

export const metadata: Metadata = { title: "Nutrients" };

export default async function NutrientsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date, today } = await getSelectedDay(searchParams);
  const user = await getCurrentUser();
  const day = await getDayView(user.id, date);

  const charted = MICRO_KEYS.map((k) => day.nutrients[k])
    .filter((v) => v.status !== "no-data" && v.target?.direction === "minimum" && v.fraction !== null)
    .sort((a, b) => a.fraction! - b.fraction!)
    .map((v) => ({
      name: NUTRIENTS[v.key].name,
      percent: v.fraction! * 100,
      shown: Math.min(v.fraction! * 100, COVERAGE_AXIS_MAX),
      detail: `${formatAmount(v.key, v.consumed)} of ${formatWithUnit(v.key, v.target!.amount)}`,
    }));

  const groups: { title: string; keys: readonly NutrientKey[] }[] = [
    { title: "Macronutrients", keys: ["protein", "carbs", "fat", "fibre"] },
    { title: "Vitamins", keys: VITAMIN_KEYS },
    { title: "Minerals", keys: MINERAL_KEYS },
  ];

  return (
    <>
      <PageHeader title="Nutrients" description="Every nutrient for the day. Open one to see what it does and where it came from.">
        <DateNav date={date} today={today} />
      </PageHeader>

      {day.entries.length > 0 && charted.length > 0 ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Share of daily reference reached</CardTitle>
            <CardDescription>
              Vitamins and minerals with a minimum target, lowest first. Bars stop at {COVERAGE_AXIS_MAX}%. Sodium and
              nutrients without data are listed below instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoverageChart data={charted} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <Card key={group.title} asSection>
            <CardHeader className="pb-3 sm:pb-3">
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <div className="divide-y border-t">
              {group.keys.map((key) => (
                <NutrientDetails key={key} view={day.nutrients[key]} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function NutrientDetails({ view }: { view: NutrientView }) {
  const def = NUTRIENTS[view.key];
  const meta = STATUS_META[view.status];
  const Icon = meta.icon;
  const target = view.target;
  const noData = view.status === "no-data";

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-muted/40 sm:gap-5 sm:px-6 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm">
              <span className="font-medium">{def.name}</span>
              {def.alias ? <span className="ml-1.5 text-xs text-muted-foreground">{def.alias}</span> : null}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {noData ? (
                "No data"
              ) : (
                <>
                  {view.coverage === "partial" ? "≥ " : ""}
                  <span className="text-foreground">{formatAmount(view.key, view.consumed)}</span>
                  {target ? ` / ${formatAmount(view.key, target.amount)}` : ""} {def.unit}
                </>
              )}
            </span>
          </div>
          <Meter fraction={view.fraction} status={view.status} label={def.name} className="mt-2" />
        </div>
        <span className={cn("hidden w-36 shrink-0 items-center gap-1.5 text-xs font-medium sm:flex", meta.text)}>
          {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
          {meta.label}
          {view.fraction !== null && !noData ? (
            <span className="ml-auto tabular-nums">{formatPercent(view.fraction)}</span>
          ) : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="grid gap-6 bg-muted/30 px-5 py-5 text-sm sm:px-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className={cn("flex items-center gap-1.5 text-xs font-medium sm:hidden", meta.text)}>
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {meta.label}
            {view.fraction !== null && !noData ? ` · ${formatPercent(view.fraction)}` : ""}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="Consumed" value={noData ? "Unknown" : formatWithUnit(view.key, view.consumed)} />
            {target ? (
              <Stat
                label={target.direction === "limit" ? "Daily limit" : "Daily reference"}
                value={formatWithUnit(view.key, target.amount)}
                badge={ORIGIN_LABELS[target.origin].short}
              />
            ) : null}
            {target && view.remaining !== null && target.direction !== "limit" && !noData ? (
              <Stat label="Remaining" value={formatWithUnit(view.key, view.remaining)} />
            ) : null}
            {target?.upper ? (
              <Stat
                label={target.upper.kind === "UL" ? "Upper limit (UL)" : "Safe level of intake"}
                value={formatWithUnit(view.key, target.upper.amount)}
              />
            ) : null}
          </dl>
          {target ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {ORIGIN_LABELS[target.origin].long}.{target.note ? ` ${target.note}` : ""}
            </p>
          ) : null}
          {target?.upper ? <UpperNote view={view} /> : null}
          {view.missingFrom.length > 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Incomplete data.</span> No value in the source database for:{" "}
              {[...new Set(view.missingFrom)].join("; ")}.{" "}
              {noData ? "Intake cannot be estimated." : "The amount shown is a minimum."}
            </p>
          ) : null}
          {view.topContributors.length > 0 ? (
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Top sources this day</h3>
              <ul className="flex flex-col gap-1">
                {view.topContributors.map((c, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{c.label}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{formatWithUnit(view.key, c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 leading-relaxed">
          {def.functions ? <Info title="What it does" text={def.functions} /> : null}
          {def.sources ? <Info title="Food sources" text={def.sources} /> : null}
          {def.considerations ? <Info title="Good to know" text={def.considerations} /> : null}
        </div>
      </div>
    </details>
  );
}

function UpperNote({ view }: { view: NutrientView }) {
  const upper = view.target!.upper!;
  const def = NUTRIENTS[view.key];
  let text: string;
  if (upper.basis === "supplemental-only") {
    text = "This level applies only to supplements and added forms, so it is not compared with your food log.";
  } else {
    const what = upper.basis === "total" ? "total intake" : upper.basis.label;
    if (view.upper?.evaluable && view.upper.consumed !== null && view.upper.fraction !== null) {
      text = `Applies to ${what}: ${formatAmount(view.key, view.upper.consumed)} ${def.unit} logged, ${formatPercent(view.upper.fraction)} of the level.`;
    } else {
      text = `Applies to ${what}. Not enough data logged to compare.`;
    }
  }
  return <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>;
}

function Stat({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium tabular-nums">
        {value}
        {badge ? <Badge>{badge}</Badge> : null}
      </dd>
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}
