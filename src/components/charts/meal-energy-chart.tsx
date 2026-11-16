"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

export interface MealEnergyDatum {
  meal: string;
  kcal: number;
  items: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: MealEnergyDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{d.meal}</div>
      <div className="text-muted-foreground tabular-nums">
        {formatNumber(d.kcal)} kcal · {d.items} {d.items === 1 ? "item" : "items"}
      </div>
    </div>
  );
}

/** Energy per meal for one day: one series, so one hue and no legend. */
export function MealEnergyChart({ data }: { data: MealEnergyDatum[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="meal"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis hide domain={[0, (max: number) => Math.max(max, 100)]} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
          <Bar dataKey="kcal" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            <LabelList
              dataKey="kcal"
              position="top"
              formatter={(v: unknown) => (typeof v === "number" && v > 0 ? formatNumber(v) : "")}
              style={{ fill: "var(--foreground)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
