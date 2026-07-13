import assert from "node:assert/strict";
import {
  concernAddressedStatus,
  fixStatusLabel,
  groupByLineage,
  parseVerdict,
  recommendedFixStatus,
  sidebarLineageVersions,
} from "../src/lib/lineage/lineage.ts";
import { deriveStartupWorkspace } from "../src/lib/lineage/workspace.ts";
import {
  deriveNextActionFromPanel,
  deriveNextActionFromStatus,
} from "../src/features/history/workspace-next-action.ts";
import { deriveExperiment, experimentSummaryLine } from "../src/lib/experiment/experiment.ts";

/** Mirror of `isWorkspaceHistoryEnabled` — Next env modules are not loaded in node scripts. */
function isWorkspaceHistoryEnabled() {
  return process.env.NEXT_PUBLIC_WORKSPACE_HISTORY !== "false";
}

const baseVerdict = {
  judge: "vc",
  verdict: "FAIL",
  roast: "Distribution is expensive and the market does not look venture scale.",
  score: 3,
  key_concern: "No urgent buyer.",
};

const improved = {
  ...baseVerdict,
  score: 5,
  key_concern: "Still unclear ICP.",
};

assert.equal(concernAddressedStatus(baseVerdict, improved), "Likely addressed");
assert.equal(
  concernAddressedStatus(
    { ...baseVerdict, score: 6 },
    { ...baseVerdict, score: 4, key_concern: "Buyer still unclear." },
  ),
  "Still open",
);
assert.equal(
  concernAddressedStatus(
    { ...baseVerdict, verdict: "FAIL", score: 4 },
    { ...baseVerdict, verdict: "CONDITIONAL", score: 4, key_concern: "ICP still fuzzy." },
  ),
  "Likely addressed",
);
assert.equal(
  recommendedFixStatus({ ...baseVerdict, recommended_fix: "Run five buyer interviews." }, improved),
  "Likely addressed",
);
assert.equal(
  recommendedFixStatus(
    { ...baseVerdict, recommended_fix: "Run five buyer interviews.", score: 5 },
    { ...baseVerdict, score: 3 },
  ),
  "Still open",
);
assert.equal(recommendedFixStatus(baseVerdict, improved), null);
assert.equal(fixStatusLabel("Concern shifted"), "Status unclear");

const runs = [1, 2, 3, 4, 5].map((version) => ({
  run_id: `run-${version}`,
  status: "completed",
  idea_preview: `Pitch v${version}`,
  created_at: `2026-01-0${version}T12:00:00Z`,
  version,
  parent_run_id: version > 1 ? `run-${version - 1}` : null,
}));

const { visible, hidden } = sidebarLineageVersions(
  runs.sort((a, b) => a.version - b.version),
);
assert.deepEqual(visible.map((r) => r.version), [4, 5]);
assert.deepEqual(hidden.map((r) => r.version), [1, 2, 3]);

const grouped = groupByLineage(runs);
assert.equal(grouped.length, 1);
assert.deepEqual(grouped[0].map((r) => r.version), [1, 2, 3, 4, 5]);

const workspaceLineage = [
  {
    run_id: "root-1",
    status: "completed",
    idea_preview: "AI scheduling for clinics",
    created_at: "2026-01-01T12:00:00Z",
    version: 1,
    parent_run_id: null,
    verdict_summary: { pass: 1, fail: 2, conditional: 2, avg_score: 4.2 },
  },
  {
    run_id: "child-2",
    status: "completed",
    idea_preview: "AI scheduling for clinics v2",
    created_at: "2026-01-02T12:00:00Z",
    version: 2,
    parent_run_id: "root-1",
    verdict_summary: { pass: 2, fail: 1, conditional: 2, avg_score: 5.1 },
  },
];

const workspace = deriveStartupWorkspace(grouped[0]);
assert.equal(workspace.workspaceId, "run-1");
assert.equal(workspace.displayName, "Pitch v1");
assert.equal(workspace.versionCount, 5);

const singleWorkspace = deriveStartupWorkspace(workspaceLineage);
assert.equal(singleWorkspace.workspaceId, "root-1");
assert.equal(singleWorkspace.displayName, "AI scheduling for clinics");
assert.equal(singleWorkspace.versionCount, 2);
assert.equal(singleWorkspace.currentScore, 5.1);
assert.equal(singleWorkspace.latestDelta, 0.9);

assert.equal(
  deriveNextActionFromStatus({ run_id: "child-2", status: "running" }).label,
  "Open review",
);

const panelVerdicts = [
  {
    judge: "pm",
    verdict: "CONDITIONAL",
    roast: "Needs clearer ICP.",
    score: 5,
    key_concern: "Who buys first?",
    recommended_fix: "Interview five clinic admins about scheduling pain.",
  },
];

const verdicts = panelVerdicts
  .map(parseVerdict)
  .filter((verdict) => verdict !== null);
const expectedDetail = experimentSummaryLine(
  deriveExperiment("child-2", null, null, verdicts),
);
const panelAction = deriveNextActionFromPanel("child-2", "completed", panelVerdicts);
assert.equal(panelAction.label, "Complete experiment");
assert.equal(panelAction.detail, expectedDetail);
assert.match(panelAction.detail, /Interview five clinic admins/);

const priorFlag = process.env.NEXT_PUBLIC_WORKSPACE_HISTORY;
process.env.NEXT_PUBLIC_WORKSPACE_HISTORY = "false";
assert.equal(isWorkspaceHistoryEnabled(), false);
process.env.NEXT_PUBLIC_WORKSPACE_HISTORY = priorFlag;

console.log("test-lineage: ok");
