import { Check, CircleAlert, CircleDashed, TriangleAlert, type LucideIcon } from "lucide-react";
import type { IntakeStatus } from "@/domain/calc/status";

export interface StatusMeta {
  label: string;
  icon: LucideIcon | null;
  /** Fill colour of the meter. */
  bar: string;
  /** Text colour for the status label and icon. */
  text: string;
}

export const STATUS_META: Record<IntakeStatus, StatusMeta> = {
  below: { label: "Below target", icon: null, bar: "bg-series-1", text: "text-muted-foreground" },
  within: { label: "Within limit", icon: Check, bar: "bg-series-1", text: "text-muted-foreground" },
  met: { label: "Target met", icon: Check, bar: "bg-good", text: "text-good-text" },
  "near-upper": { label: "Near upper limit", icon: TriangleAlert, bar: "bg-warning", text: "text-warning-text" },
  over: { label: "Above limit", icon: CircleAlert, bar: "bg-critical", text: "text-critical-text" },
  "no-data": { label: "No data", icon: CircleDashed, bar: "bg-transparent", text: "text-muted-foreground" },
};
