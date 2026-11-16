"use client";

import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { Meal } from "@prisma/client";
import { Button, type buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { VariantProps } from "class-variance-authority";
import type { FoodView } from "@/server/foods";
import { FoodPicker } from "./food-picker";
import { LogFoodForm } from "./log-food-form";

/**
 * "Add food" button + dialog. Without `food` it starts with a search step;
 * with `food` it goes straight to the serving form.
 */
export function AddFoodDialog({
  date,
  meal,
  food: presetFood,
  label = "Add food",
  variant,
  size,
  className,
}: {
  date: string;
  meal?: Meal;
  food?: FoodView;
  label?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FoodView | null>(null);
  const food = presetFood ?? picked;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Always start a new session at the search step. Resetting on open
        // (not on close) also covers closing programmatically after a save.
        if (next) setPicked(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Plus />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {food ? (
          <>
            <DialogHeader>
              {presetFood ? null : (
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="mb-1 flex w-fit items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Back to search
                </button>
              )}
              <DialogTitle>{food.name}</DialogTitle>
              <DialogDescription>
                {food.brand ? `${food.brand} · ` : ""}
                {food.source.id === "usda-sr-legacy" ? "USDA SR Legacy" : food.source.name} · {food.completeness.known} of{" "}
                {food.completeness.total} nutrients available
              </DialogDescription>
            </DialogHeader>
            <LogFoodForm key={food.id} food={food} date={date} defaultMeal={meal} onDone={() => setOpen(false)} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add food</DialogTitle>
              <DialogDescription>Search the food database, then choose a serving size.</DialogDescription>
            </DialogHeader>
            <FoodPicker onPick={setPicked} scanHref={`/scan?date=${date}${meal ? `&meal=${meal}` : ""}`} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
