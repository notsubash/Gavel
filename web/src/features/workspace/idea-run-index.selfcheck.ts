/**
 * Self-check for Ideas KPI index join.
 * Run: npx tsx src/features/workspace/idea-run-index.selfcheck.ts
 */
import assert from "node:assert/strict";

import type { RunListItem } from "@/lib/api/types-helpers";

import { indexRunsByWorkspaceId } from "./idea-run-index";

function run(partial: Partial<RunListItem> & Pick<RunListItem, "run_id">): RunListItem {
  return {
    status: "completed",
    idea_preview: "Idea",
    created_at: "2026-01-01T00:00:00Z",
    version: 1,
    ...partial,
  } as RunListItem;
}

const runs: RunListItem[] = [
  run({
    run_id: "r1",
    workspace_id: "ws-a",
    created_at: "2026-01-01T00:00:00Z",
    version: 1,
    verdict_summary: { pass: 0, fail: 1, conditional: 0, avg_score: 3 },
  }),
  run({
    run_id: "r2",
    workspace_id: "ws-a",
    parent_run_id: "r1",
    created_at: "2026-01-02T00:00:00Z",
    version: 2,
    verdict_summary: { pass: 0, fail: 1, conditional: 0, avg_score: 5 },
  }),
  run({
    run_id: "r3",
    workspace_id: "ws-b",
    created_at: "2026-01-03T00:00:00Z",
  }),
  run({
    run_id: "r4",
    // no workspace_id — ignored
    created_at: "2026-01-04T00:00:00Z",
  }),
];

const map = indexRunsByWorkspaceId(runs);
assert.equal(map.size, 2);
assert.equal(map.get("ws-a")?.latestRunId, "r2");
assert.equal(map.get("ws-a")?.versionCount, 2);
assert.equal(map.get("ws-a")?.currentScore, 5);
assert.equal(map.get("ws-a")?.latestDelta, 2);
assert.equal(map.get("ws-b")?.latestRunId, "r3");
assert.equal(map.has("r4"), false);

// Truncated feed: parent missing — still attach latest present run for the idea.
const truncated = indexRunsByWorkspaceId([
  run({
    run_id: "r2-only",
    workspace_id: "ws-a",
    parent_run_id: "missing-parent",
    created_at: "2026-01-02T00:00:00Z",
    version: 2,
    verdict_summary: { pass: 0, fail: 1, conditional: 0, avg_score: 5 },
  }),
]);
assert.equal(truncated.get("ws-a")?.latestRunId, "r2-only");
assert.equal(truncated.get("ws-a")?.currentScore, 5);

console.log("idea-run-index.selfcheck: ok");
