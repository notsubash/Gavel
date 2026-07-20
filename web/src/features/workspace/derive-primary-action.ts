import type { ValidationOverview, ValidationStage, WorkspaceLifecycle } from "@/lib/api/workspaces";
import { RUN_PAGE_COPY } from "@/features/run/run-page-copy";

export type PrimaryAction = {
  label: string;
  href: string;
};

const WORKSHEET_STAGES = new Set<ValidationStage>(["problem_clarity"]);

function stageHref(base: string, stage: ValidationStage, nextAction: string): string {
  if (WORKSHEET_STAGES.has(stage)) return `${base}/worksheet`;
  if (stage === "problem_evidence" && nextAction.toLowerCase().includes("interview")) {
    return `${base}/validation?log_interview=1`;
  }
  return `${base}/validation#stage-${stage}`;
}

function stageLabel(stage: ValidationStage, nextAction: string): string {
  const lower = nextAction.toLowerCase();
  if (stage === "problem_clarity") return "Edit pitch";
  if (stage === "problem_evidence") {
    return lower.includes("interview") ? "Log interview" : "Add evidence";
  }
  if (stage === "solution_evidence") {
    if (lower.includes("run your experiment")) return "Continue experiment";
    return lower.includes("experiment") ? "Start experiment" : "Continue validation";
  }
  if (stage === "willingness_to_pay") return "Test pricing";
  if (stage === "channel") return "Test channel";
  if (stage === "competition_moat") return "Map competitors";
  return nextAction.length > 40 ? `${nextAction.slice(0, 37)}…` : nextAction;
}

/** ponytail: mirrors backend checklist._next_action routing; upgrade path is server-driven copy */
export function derivePrimaryAction(
  workspaceId: string,
  lifecycle: WorkspaceLifecycle,
  overview: ValidationOverview | null | undefined,
): PrimaryAction {
  const base = `/workspaces/${workspaceId}`;

  if (!overview) {
    if (lifecycle === "draft") {
      return { label: "Edit pitch", href: `${base}/worksheet` };
    }
    return { label: "Go to validation", href: `${base}/validation` };
  }

  // Match backend: active experiment wins over readiness/judges
  if (overview.active_experiment) {
    return { label: "Add evidence", href: `${base}/validation` };
  }

  if (overview.readiness.can_run_judges) {
    return { label: RUN_PAGE_COPY.startReview, href: `${base}/judges` };
  }

  if (lifecycle === "judged" || lifecycle === "iterating") {
    return { label: RUN_PAGE_COPY.revisePitch, href: `${base}/worksheet?revise=1` };
  }

  const nextStage = overview.checklist.next_stage;
  if (nextStage) {
    const nextAction = overview.checklist.next_action;
    return {
      label: stageLabel(nextStage, nextAction),
      href: stageHref(base, nextStage, nextAction),
    };
  }

  if (lifecycle === "draft") {
    return { label: "Edit pitch", href: `${base}/worksheet` };
  }

  return { label: "Go to validation", href: `${base}/validation` };
}

export type ValidationWorkbenchKind =
  | "log_interview"
  | "add_evidence"
  | "start_experiment"
  | "scan_competitors";

export type ValidationWorkbenchAction = {
  kind: ValidationWorkbenchKind;
  label: string;
};

/** Primary Validation toolbar action from the same checklist as Case home. */
export function deriveValidationWorkbenchAction(
  overview: ValidationOverview | null | undefined,
): ValidationWorkbenchAction {
  if (overview?.active_experiment) {
    return { kind: "add_evidence", label: "Add evidence" };
  }

  const stage = overview?.checklist.next_stage;
  const nextAction = overview?.checklist.next_action ?? "";
  const lower = nextAction.toLowerCase();

  if (stage === "problem_evidence" && lower.includes("interview")) {
    return { kind: "log_interview", label: "Log interview" };
  }
  if (stage === "solution_evidence" && lower.includes("experiment")) {
    return {
      kind: "start_experiment",
      label: lower.includes("run your experiment") ? "Continue experiment" : "Start experiment",
    };
  }
  if (stage === "competition_moat") {
    return { kind: "scan_competitors", label: "Map competitors" };
  }
  if (stage === "problem_evidence") {
    return { kind: "add_evidence", label: "Add evidence" };
  }

  return { kind: "add_evidence", label: "Add evidence" };
}
