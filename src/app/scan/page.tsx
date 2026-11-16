import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ScanFlow } from "@/components/scan/scan-flow";
import { formatDay } from "@/lib/dates";
import { getSelectedDay } from "@/server/request";

export const metadata: Metadata = { title: "Scan Barcode" };

const MEALS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; meal?: string | string[] }>;
}) {
  const { date, today } = await getSelectedDay(searchParams);
  const mealParam = (await searchParams).meal;
  const meal = MEALS.find((m) => m === (Array.isArray(mealParam) ? mealParam[0] : mealParam));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Scan Barcode"
        description={`Look up a packaged food and add it to ${date === today ? "today's diary" : `the diary for ${formatDay(date, today)}`}.`}
      />
      <ScanFlow date={date} meal={meal} />
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Packaged-food data comes from{" "}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Open Food Facts
        </a>{" "}
        (Open Database License). Scanned products are saved locally so repeat scans work without another request.
      </p>
    </div>
  );
}
