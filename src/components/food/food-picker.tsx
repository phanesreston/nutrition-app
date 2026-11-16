"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { FoodView } from "@/server/foods";

/** Debounced food search that reports the chosen food to its parent. */
export function FoodPicker({ onPick }: { onPick: (food: FoodView) => void }) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<FoodView[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { foods: FoodView[] };
          setFoods(data.foods);
          setFailed(false);
        } catch (e) {
          if ((e as Error).name !== "AbortError") setFailed(true);
        }
      },
      query ? 180 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          type="search"
          placeholder="Search foods, e.g. kale, salmon, oats"
          aria-label="Search foods"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="-mx-2 h-[46dvh] overflow-y-auto sm:h-80" aria-live="polite">
        {failed ? (
          <p className="px-2 py-6 text-center text-sm text-critical-text">Search failed. Check that the app is running and try again.</p>
        ) : foods === null ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : foods.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No foods match “{query}”. The seed database is small — try a simpler term.
          </p>
        ) : (
          <ul>
            {foods.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => onPick(food)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{food.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{food.category}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {food.per100g.energy !== undefined ? `${formatNumber(food.per100g.energy)} kcal` : "–"} / 100 g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
