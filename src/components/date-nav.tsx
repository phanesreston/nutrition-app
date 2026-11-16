"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDay, isIsoDay, shiftDay } from "@/lib/dates";

/** Previous / next day and a calendar picker. The selected day lives in `?date=`. */
export function DateNav({ date, today }: { date: string; today: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const href = (day: string) => (day === today ? pathname : `${pathname}?date=${day}`);

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
      <Button asChild variant="ghost" size="icon-sm">
        <Link href={href(shiftDay(date, -1))} aria-label="Previous day">
          <ChevronLeft />
        </Link>
      </Button>
      <label className="relative flex h-8 min-w-28 cursor-pointer items-center justify-center rounded-md px-2 text-sm font-medium hover:bg-muted">
        <span>{formatDay(date, today)}</span>
        <input
          type="date"
          aria-label="Choose a day"
          value={date}
          max={shiftDay(today, 365)}
          onChange={(e) => {
            if (isIsoDay(e.target.value)) router.push(href(e.target.value));
          }}
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Button asChild variant="ghost" size="icon-sm">
        <Link href={href(shiftDay(date, 1))} aria-label="Next day">
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}
