import type { ValidationOverview, ValidationStage, WorkspaceLifecycle } from "@/lib/api/workspaces";

export type PrimaryAction = {
  label: string;
  href: string;
};

const WORKSHEET_STAGES = new Set<ValidationStage>(["problem_clarity"]);

function stageHref(base: string, stage: ValidationStage, nextAction: string): string {
  if (WORKSHEET_STAGES.has(stage)) return `${base}/worksheet`;
  if (stage === "problem_evidence" && nextAction.toLowerCase().includes("interview")) {
    return `${base}?plan_interview=1`;
  }
  return `${base}/validation#stage-${stage}`;
}

function stageLabel(stage: ValidationStage, nextAction: string): string {
  const lower = nextAction.toLowerCase();
  if (stage === "problem_clarity") return "Edit worksheet";
  if (stage === "problem_evidence") {
    return lower.includes("interview") ? "Plan interview" : "Add evidence";
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
      return { label: "Edit worksheet", href: `${base}/worksheet` };
    }
    return { label: "Go to validation", href: `${base}/validation` };
  }

  // Match backend: active experiment wins over readiness/judges
  if (overview.active_experiment) {
    return { label: "Add evidence", href: `${base}/validation` };
  }

  if (overview.readiness.can_run_judges) {
    return { label: "Run judges", href: `${base}/judges` };
  }

  if (lifecycle === "judged" || lifecycle === "iterating") {
    return { label: "Revise worksheet", href: `${base}/worksheet?revise=1` };
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
    return { label: "Edit worksheet", href: `${base}/worksheet` };
  }

  return { label: "Go to validation", href: `${base}/validation` };
}
