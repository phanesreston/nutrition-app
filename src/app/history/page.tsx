import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" description="Trends in energy, macronutrients and individual micronutrients." />
      <p className="mb-4 text-sm text-muted-foreground">
        You can already browse any past day from the date picker on the{" "}
        <Link href="/" className="font-medium text-foreground underline underline-offset-4">
          Dashboard
        </Link>{" "}
        and{" "}
        <Link href="/diary" className="font-medium text-foreground underline underline-offset-4">
          Food Diary
        </Link>
        .
      </p>
      <ComingSoon
        phase="phase 4"
        items={[
          { title: "Calendar", text: "A month view showing which days are logged and how complete each was." },
          { title: "Weekly and monthly averages", text: "Average intake per nutrient against your reference values." },
          { title: "Micronutrient trends", text: "A line per nutrient over time, with your target as the baseline." },
          { title: "Target consistency", text: "How many days in a period each target was met." },
        ]}
      />
    </>
  );
}
