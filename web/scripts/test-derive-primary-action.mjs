import assert from "node:assert/strict";

/** Inline copy of derivePrimaryAction for node self-check (no TS path aliases). */
function stageHref(base, stage, nextAction) {
  if (stage === "problem_clarity") return `${base}/worksheet`;
  if (stage === "problem_evidence" && nextAction.toLowerCase().includes("interview")) {
    return `${base}?plan_interview=1`;
  }
  return `${base}/validation#stage-${stage}`;
}

function stageLabel(stage, nextAction) {
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
  return nextAction;
}

function derivePrimaryAction(workspaceId, lifecycle, overview) {
  const base = `/workspaces/${workspaceId}`;
  if (!overview) {
    if (lifecycle === "draft") return { label: "Edit worksheet", href: `${base}/worksheet` };
    return { label: "Go to validation", href: `${base}/validation` };
  }
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
    return { label: stageLabel(nextStage, nextAction), href: stageHref(base, nextStage, nextAction) };
  }
  if (lifecycle === "draft") {
    return { label: "Edit worksheet", href: `${base}/worksheet` };
  }
  return { label: "Go to validation", href: `${base}/validation` };
}

assert.equal(derivePrimaryAction("abc", "testing", null).label, "Go to validation");
assert.equal(derivePrimaryAction("abc", "draft", null).label, "Edit worksheet");

const clarityOverview = {
  readiness: { can_run_judges: false },
  active_experiment: null,
  checklist: {
    next_stage: "problem_clarity",
    next_action: "Sharpen audience and problem until they stand without the solution",
  },
};
const clarity = derivePrimaryAction("abc", "discovery", clarityOverview);
assert.equal(clarity.label, "Edit worksheet");
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
assert.equal(interview.label, "Plan interview");
assert.equal(interview.href, "/workspaces/abc?plan_interview=1");

const judgesOverview = {
  readiness: { can_run_judges: true },
  active_experiment: null,
  checklist: { next_stage: "problem_clarity", next_action: "ignored" },
};
assert.equal(derivePrimaryAction("abc", "testing", judgesOverview).label, "Run judges");

const activeExpOverview = {
  readiness: { can_run_judges: true },
  active_experiment: { id: "1" },
  checklist: { next_stage: null, next_action: "Run your experiment: Smoke test" },
};
assert.equal(derivePrimaryAction("abc", "testing", activeExpOverview).label, "Add evidence");

console.log("derive-primary-action: ok");
