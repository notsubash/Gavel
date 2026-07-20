import assert from "node:assert/strict";

/** Inline mirror of derivePrimaryAction for node self-check (no TS path aliases). */
function stageHref(base, stage, nextAction) {
  if (stage === "problem_clarity") return `${base}/worksheet`;
  if (stage === "problem_evidence" && nextAction.toLowerCase().includes("interview")) {
    return `${base}/validation?log_interview=1`;
  }
  return `${base}/validation#stage-${stage}`;
}

function stageLabel(stage, nextAction) {
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
  return nextAction;
}

function derivePrimaryAction(workspaceId, lifecycle, overview) {
  const base = `/workspaces/${workspaceId}`;
  if (!overview) {
    if (lifecycle === "draft") return { label: "Edit pitch", href: `${base}/worksheet` };
    return { label: "Go to validation", href: `${base}/validation` };
  }
  if (overview.active_experiment) {
    return { label: "Add evidence", href: `${base}/validation` };
  }
  if (overview.readiness.can_run_judges) {
    return { label: "Start review", href: `${base}/judges` };
  }
  if (lifecycle === "judged" || lifecycle === "iterating") {
    return { label: "Revise pitch", href: `${base}/worksheet?revise=1` };
  }
  const nextStage = overview.checklist.next_stage;
  if (nextStage) {
    const nextAction = overview.checklist.next_action;
    return { label: stageLabel(nextStage, nextAction), href: stageHref(base, nextStage, nextAction) };
  }
  if (lifecycle === "draft") {
    return { label: "Edit pitch", href: `${base}/worksheet` };
  }
  return { label: "Go to validation", href: `${base}/validation` };
}

assert.equal(derivePrimaryAction("abc", "testing", null).label, "Go to validation");
assert.equal(derivePrimaryAction("abc", "draft", null).label, "Edit pitch");

const clarityOverview = {
  readiness: { can_run_judges: false },
  active_experiment: null,
  checklist: {
    next_stage: "problem_clarity",
    next_action: "Sharpen audience and problem until they stand without the solution",
  },
};
const clarity = derivePrimaryAction("abc", "discovery", clarityOverview);
assert.equal(clarity.label, "Edit pitch");
assert.equal(clarity.href, "/workspaces/abc/worksheet");

const interviewOverview = {
  readiness: { can_run_judges: false },
  active_experiment: null,
  checklist: {
    next_stage: "problem_evidence",
    next_action: "Plan your first customer interview",
  },
};
const interview = derivePrimaryAction("abc", "discovery", interviewOverview);
assert.equal(interview.label, "Log interview");
assert.equal(interview.href, "/workspaces/abc/validation?log_interview=1");

const judgesOverview = {
  readiness: { can_run_judges: true },
  active_experiment: null,
  checklist: { next_stage: "problem_clarity", next_action: "ignored" },
};
assert.equal(derivePrimaryAction("abc", "testing", judgesOverview).label, "Start review");

const activeExpOverview = {
  readiness: { can_run_judges: true },
  active_experiment: { id: "1" },
  checklist: { next_stage: null, next_action: "Run your experiment: Smoke test" },
};
assert.equal(derivePrimaryAction("abc", "testing", activeExpOverview).label, "Add evidence");

function deriveValidationWorkbenchAction(overview) {
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
  return { kind: "add_evidence", label: "Add evidence" };
}

assert.equal(deriveValidationWorkbenchAction(interviewOverview).kind, "log_interview");
assert.equal(deriveValidationWorkbenchAction(activeExpOverview).kind, "add_evidence");
assert.equal(
  deriveValidationWorkbenchAction({
    active_experiment: null,
    checklist: { next_stage: "competition_moat", next_action: "Map competitors" },
  }).kind,
  "scan_competitors",
);
assert.equal(
  deriveValidationWorkbenchAction({
    active_experiment: null,
    checklist: {
      next_stage: "solution_evidence",
      next_action: "Design an experiment to test: X",
    },
  }).label,
  "Start experiment",
);

console.log("derive-primary-action: ok");
