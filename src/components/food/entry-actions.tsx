"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteDiaryEntry } from "@/server/actions";
import type { EntryView } from "@/server/day";
import type { FoodView } from "@/server/foods";
import { LogFoodForm } from "./log-food-form";

/** Edit and delete controls for one diary entry. */
export function EntryActions({ entry, food, date }: { entry: EntryView; food: FoodView; date: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteDiaryEntry(entry.id);
      if (result.ok) toast.success(`Removed ${entry.foodName}`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${entry.foodName}`} onClick={() => setEditing(true)}>
        <Pencil className="text-muted-foreground" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${entry.foodName}`} disabled={pending} onClick={remove}>
        <Trash2 className="text-muted-foreground" />
      </Button>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entry.foodName}</DialogTitle>
            <DialogDescription>Change the amount or move it to another meal.</DialogDescription>
          </DialogHeader>
          <LogFoodForm
            food={food}
            date={date}
            entry={{ id: entry.id, meal: entry.meal, quantity: entry.quantity, unitLabel: entry.unitLabel }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
