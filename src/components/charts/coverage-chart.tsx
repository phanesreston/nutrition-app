"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { COVERAGE_AXIS_MAX, type CoverageDatum } from "./coverage";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: CoverageDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{d.name}</div>
      <div className="text-muted-foreground tabular-nums">
        {formatNumber(d.percent)}% of target · {d.detail}
      </div>
    </div>
  );
}

/** Micronutrients ranked by share of target reached, lowest first. */
export function CoverageChart({ data }: { data: CoverageDatum[] }) {
  return (
    <div style={{ height: data.length * 26 + 44 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 16, right: 16, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={[0, COVERAGE_AXIS_MAX]}
            ticks={[0, 50, 100, 150, 200]}
            tickFormatter={(v: number) => (v === COVERAGE_AXIS_MAX ? `${v}%+` : `${v}%`)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={112}
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
          <ReferenceLine
            x={100}
            stroke="var(--foreground)"
            strokeWidth={1}
            label={{ value: "Target", position: "top", fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Bar dataKey="shown" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
