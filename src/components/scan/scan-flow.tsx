"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CircleAlert, Keyboard, Loader2, PackageSearch, PencilLine, RotateCcw, SearchX } from "lucide-react";
import type { Meal } from "@prisma/client";
import { LogFoodForm } from "@/components/food/log-food-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseBarcode } from "@/domain/barcode";
import { BASE_PATH } from "@/lib/base-path";
import type { BarcodeLookup } from "@/server/barcode";
import { BarcodeScanner } from "./barcode-scanner";
import { CustomFoodForm } from "./custom-food-form";
import { ProductPreview } from "./product-preview";

type Step =
  | { name: "idle" }
  | { name: "scanning" }
  | { name: "loading"; barcode: string }
  | { name: "result"; lookup: BarcodeLookup }
  | { name: "custom"; barcode?: string; initialName?: string; initialBrand?: string }
  | { name: "logged"; foodName: string };

const ERROR_TEXT = {
  timeout: "Open Food Facts took too long to answer.",
  "rate-limited": "Too many lookups in a short time. Wait a minute before trying again.",
  unavailable: "Open Food Facts could not be reached right now.",
} as const;

/** Scan or type a barcode -> look it up -> preview -> choose a serving -> log. */
export function ScanFlow({ date, meal }: { date: string; meal?: Meal }) {
  const id = useId();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const request = useRef(0);

  const lookup = useCallback(async (code: string, format?: string) => {
    const current = ++request.current;
    setStep({ name: "loading", barcode: code });
    let result: BarcodeLookup;
    try {
      const query = format ? `?format=${encodeURIComponent(format)}` : "";
      const res = await fetch(`${BASE_PATH}/api/barcode/${encodeURIComponent(code)}${query}`);
      result = (await res.json()) as BarcodeLookup;
      if (!result || typeof result.status !== "string") throw new Error("Unexpected response");
    } catch {
      // Our own server could not be reached or answered with something unexpected.
      result = { status: "error", barcode: code, reason: "unavailable" };
    }
    if (current === request.current) setStep({ name: "result", lookup: result });
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseBarcode(manual);
    if (!parsed) {
      setManualError(
        /^\d[\d\s-]*$/.test(manual.trim())
          ? "That number is not a valid barcode. Check the digits — the last one is a check digit."
          : "Enter the 8, 12 or 13 digits printed under the barcode.",
      );
      return;
    }
    setManualError(null);
    lookup(parsed.code);
  }

  const reset = () => {
    request.current++;
    setManual("");
    setManualError(null);
    setStep({ name: "idle" });
  };

  // ---- entry: camera + manual input
  if (step.name === "idle" || step.name === "scanning") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-5">
          {step.name === "scanning" ? (
            <>
              <BarcodeScanner onDetect={lookup} />
              <Button variant="outline" onClick={reset}>
                Stop camera
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStep({ name: "scanning" })}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/40 transition-colors hover:bg-muted sm:aspect-video"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Camera className="size-6" aria-hidden />
              </span>
              <span className="font-medium">Scan with camera</span>
              <span className="max-w-xs px-4 text-center text-sm text-muted-foreground">
                Point your phone at the barcode on the pack. Works with EAN and UPC codes.
              </span>
            </button>
          )}

          <form onSubmit={submitManual} noValidate className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-code`} className="flex items-center gap-1.5">
              <Keyboard className="size-4 text-muted-foreground" aria-hidden /> Or type the barcode number
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-code`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 3017620422003"
                className="font-mono"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                aria-invalid={manualError ? true : undefined}
                aria-describedby={manualError ? `${id}-code-error` : undefined}
              />
              <Button type="submit">Look up</Button>
            </div>
            {manualError ? (
              <p id={`${id}-code-error`} role="alert" className="text-sm text-critical-text">
                {manualError}
              </p>
            ) : null}
          </form>

          <p className="text-sm text-muted-foreground">
            No barcode?{" "}
            <button type="button" onClick={() => setStep({ name: "custom" })} className="font-medium text-foreground underline underline-offset-4">
              Create a custom food
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step.name === "loading") {
    return (
      <Card>
        <CardContent role="status" className="flex flex-col items-center gap-3 py-14 text-center">
          <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
          <p className="font-medium">Looking up {step.barcode}</p>
          <p className="text-sm text-muted-foreground">Checking saved products, then Open Food Facts.</p>
        </CardContent>
      </Card>
    );
  }

  if (step.name === "custom") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">New custom food</h2>
          <CustomFoodForm
            barcode={step.barcode}
            initialName={step.initialName}
            initialBrand={step.initialBrand}
            onCancel={reset}
            onSaved={(foodId) => {
              if (step.barcode) lookup(step.barcode);
              else router.push(`/foods/${foodId}`);
            }}
          />
        </CardContent>
      </Card>
    );
  }

  if (step.name === "logged") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="font-medium">Added {step.foodName} to your diary</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setStep({ name: "scanning" })}>
              <Camera /> Scan another
            </Button>
            <Button asChild variant="outline">
              <Link href={`/diary?date=${date}`}>Open diary</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- result
  const result = step.lookup;
  const again = (
    <Button variant="outline" onClick={reset}>
      <RotateCcw /> Scan another
    </Button>
  );

  if (result.status === "found") {
    const { food } = result;
    return (
      <Card>
        <CardContent className="flex flex-col gap-6">
          <ProductPreview food={food} origin={result.origin} stale={result.stale} />
          {food.per100g.energy === undefined ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep({ name: "custom", barcode: result.barcode, initialName: food.name, initialBrand: food.brand ?? "" })}>
                <PencilLine /> Enter values from the label
              </Button>
              {again}
            </div>
          ) : (
            <>
              <div className="border-t pt-5">
                <h3 className="mb-3 text-sm font-semibold">How much did you have?</h3>
                <LogFoodForm
                  key={food.id}
                  food={food}
                  date={date}
                  defaultMeal={meal}
                  onDone={() => setStep({ name: "logged", foodName: food.name })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {again}
                <Button asChild variant="ghost">
                  <Link href={`/admin/foods/${food.id}`}>
                    <PencilLine /> Something wrong? Correct it
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const message =
    result.status === "not-found"
      ? {
          icon: SearchX,
          title: "Product not found",
          text: `Barcode ${result.barcode} is not in your saved foods or in Open Food Facts. You can add it yourself from the label, and it will be found next time you scan it.`,
        }
      : result.status === "invalid"
        ? {
            icon: CircleAlert,
            title: "That is not a valid barcode",
            text: "The number did not pass the barcode check digit. Try scanning again or re-type the digits.",
          }
        : {
            icon: PackageSearch,
            title: "Lookup failed",
            text: `${ERROR_TEXT[result.reason]} The product has not been saved before, so there is no local copy. You can try again, or enter the product yourself.`,
          };

  return (
    <Card>
      <CardContent role="alert" className="flex flex-col items-center gap-4 py-10 text-center">
        <message.icon className="size-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">{message.title}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message.text}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {result.status === "error" ? (
            <Button onClick={() => lookup(result.barcode)}>
              <RotateCcw /> Try again
            </Button>
          ) : null}
          {result.status !== "invalid" ? (
            <Button variant={result.status === "error" ? "outline" : "default"} onClick={() => setStep({ name: "custom", barcode: result.barcode })}>
              <PencilLine /> Create custom food
            </Button>
          ) : null}
          {again}
        </div>
      </CardContent>
    </Card>
  );
}
