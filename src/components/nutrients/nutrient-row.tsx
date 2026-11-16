import { NUTRIENTS } from "@/domain/nutrients/catalog";
import { formatAmount, formatPercent } from "@/lib/format";
import type { NutrientView } from "@/server/day";
import { cn } from "@/lib/utils";
import { Meter } from "./meter";
import { STATUS_META } from "./status-meta";

/** Compact name / figure / meter row used on the dashboard. */
export function NutrientRow({ view, showAlias = true }: { view: NutrientView; showAlias?: boolean }) {
  const def = NUTRIENTS[view.key];
  const meta = STATUS_META[view.status];
  const Icon = meta.icon;
  const noData = view.status === "no-data";
  const partial = view.coverage === "partial";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm">
          <span className="font-medium">{def.name}</span>
          {showAlias && def.alias ? <span className="ml-1.5 text-xs text-muted-foreground">{def.alias}</span> : null}
        </span>
        <span className="flex shrink-0 items-baseline gap-2 text-sm tabular-nums">
          {noData ? (
            <span className="text-xs text-muted-foreground">No data</span>
          ) : (
            <>
              <span className="text-muted-foreground">
                {partial ? (
                  <abbr title={`At least this much: ${view.missingFrom.length} logged food(s) have no value`} className="no-underline">
                    ≥{" "}
                  </abbr>
                ) : null}
                <span className="text-foreground">{formatAmount(view.key, view.consumed)}</span>
                {view.target ? ` / ${formatAmount(view.key, view.target.amount)}` : ""} {def.unit}
              </span>
              {view.fraction !== null ? (
                <span className={cn("inline-flex w-12 items-center justify-end gap-0.5 font-medium", meta.text)}>
                  {Icon ? <Icon className="size-3.5" aria-label={meta.label} /> : null}
                  {formatPercent(view.fraction)}
                </span>
              ) : null}
            </>
          )}
        </span>
      </div>
      <Meter fraction={view.fraction} status={view.status} label={def.name} />
    </div>
  );
}
