import type { AssumptionStatus } from "@/lib/api/workspaces";

export const ASSUMPTION_STATUS_LABEL: Record<AssumptionStatus, string> = {
  untested: "Untested",
  testing: "Testing",
  supported: "Supported",
  contradicted: "Contradicted",
  retired: "Retired",
};

/** Per-status color roles for the kanban board and overview (token-driven). */
export const ASSUMPTION_STATUS_STYLE: Record<
  AssumptionStatus,
  { dot: string; text: string; accent: string; tint: string }
> = {
  untested: {
    dot: "bg-status-untested",
    text: "text-status-untested",
    accent: "border-l-status-untested",
    tint: "bg-status-untested/8",
  },
  testing: {
    dot: "bg-status-testing",
    text: "text-status-testing",
    accent: "border-l-status-testing",
    tint: "bg-status-testing/8",
  },
  supported: {
    dot: "bg-status-supported",
    text: "text-status-supported",
    accent: "border-l-status-supported",
    tint: "bg-status-supported/8",
  },
  contradicted: {
    dot: "bg-status-contradicted",
    text: "text-status-contradicted",
    accent: "border-l-status-contradicted",
    tint: "bg-status-contradicted/8",
  },
  retired: {
    dot: "bg-status-retired",
    text: "text-status-retired",
    accent: "border-l-status-retired",
    tint: "bg-status-retired/8",
  },
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
