import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <>
      <PageHeader title="Insights" description="Nutrient gaps over time and foods that would close them." />
      <ComingSoon
        phase="phases 2 and 3"
        items={[
          {
            title: "Nutrient gap analysis",
            text: "Weekly average intake per nutrient, separating a single low day from a persistent pattern.",
          },
          {
            title: "Approaching upper limits",
            text: "Nutrients repeatedly near or above an applicable upper level.",
          },
          {
            title: "Insufficient data",
            text: "Nutrients where too much of your logged food lacks a value to draw any conclusion.",
          },
          {
            title: "Food recommendations",
            text: "Rules-based suggestions ranked by how many of your gaps a realistic serving closes.",
          },
        ]}
      />
    </>
  );
}
