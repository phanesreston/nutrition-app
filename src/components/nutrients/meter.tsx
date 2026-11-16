import type { IntakeStatus } from "@/domain/calc/status";
import { cn } from "@/lib/utils";
import { STATUS_META } from "./status-meta";

/** A single ratio against its target. The fill never exceeds the track; the figure beside it carries the real value. */
export function Meter({
  fraction,
  status,
  label,
  className,
}: {
  fraction: number | null;
  status: IntakeStatus;
  label: string;
  className?: string;
}) {
  const noData = status === "no-data";
  const pct = Math.max(0, Math.min(1, fraction ?? 0)) * 100;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={noData ? undefined : Math.round((fraction ?? 0) * 100)}
      aria-valuetext={noData ? "No data" : `${Math.round((fraction ?? 0) * 100)}% of target`}
      className={cn("h-2 w-full overflow-hidden rounded-full", noData ? "track-no-data" : "bg-track", className)}
    >
      {!noData && pct > 0 ? (
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", STATUS_META[status].bar)}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      ) : null}
    </div>
  );
}
