import type { AssumptionStatus } from "@/lib/api/workspaces";

export const ASSUMPTION_STATUS_LABEL: Record<AssumptionStatus, string> = {
  untested: "Untested",
  testing: "Testing",
  supported: "Supported",
  contradicted: "Contradicted",
  retired: "Retired",
};

export const ASSUMPTION_TYPE_LABEL: Record<string, string> = {
  desirability: "Desirability",
  viability: "Viability",
  feasibility: "Feasibility",
  channel: "Channel",
  pricing: "Pricing",
  timing: "Timing",
};

export const EXPERIMENT_STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

export const EXPERIMENT_DECISION_LABEL: Record<string, string> = {
  continue: "Continue",
  revise: "Revise",
  pivot: "Pivot",
  kill: "Kill",
  retest: "Retest",
};

/** Humanize enum strings when no explicit label exists. */
export function humanizeEnum(value: string): string {
  return (
    ASSUMPTION_TYPE_LABEL[value] ??
    value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
