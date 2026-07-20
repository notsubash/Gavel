import assert from "node:assert/strict";
import test from "node:test";

import {
  countVerdictLabels,
  inferRecommendationFromVerdictSummary,
  resolveVerdictNextAction,
  revisePitchHref,
} from "../src/features/run/resolve-verdict-next-action.ts";

test("ITERATE → Submit evidence", () => {
  const action = resolveVerdictNextAction({
    runId: "run-1",
    workspaceId: "ws-1",
    recommendation: "ITERATE",
  });
  assert.equal(action.kind, "submit_evidence");
  assert.equal(action.label, "Submit evidence");
  assert.match(action.href, /#next-action$/);
});

test("GO / NO-GO → Revise pitch when workspace exists", () => {
  for (const recommendation of ["GO", "NO-GO"]) {
    const action = resolveVerdictNextAction({
      runId: "run-1",
      workspaceId: "ws-1",
      recommendation,
    });
    assert.equal(action.kind, "revise_pitch");
    assert.equal(action.label, "Revise pitch");
    assert.equal(action.href, "/workspaces/ws-1/worksheet?revise=1");
  }
});

test("GO without workspace → Open review (not mislabeled Revise)", () => {
  const action = resolveVerdictNextAction({
    runId: "run-1",
    recommendation: "GO",
  });
  assert.equal(action.kind, "open_review");
  assert.equal(action.label, "Open review");
  assert.equal(action.href, "/run/run-1#next-action");
});

test("evidence submitted → View evidence result", () => {
  const action = resolveVerdictNextAction({
    runId: "run-1",
    recommendation: "ITERATE",
    evidenceSubmitted: true,
  });
  assert.equal(action.kind, "view_evidence");
  assert.equal(action.label, "View evidence result");
});

test("inferRecommendationFromVerdictSummary", () => {
  assert.equal(
    inferRecommendationFromVerdictSummary({ pass: 5, fail: 0, conditional: 0 }),
    "GO",
  );
  assert.equal(
    inferRecommendationFromVerdictSummary({ pass: 3, fail: 0, conditional: 2 }),
    "GO",
  );
  assert.equal(
    inferRecommendationFromVerdictSummary({ pass: 0, fail: 4, conditional: 1 }),
    "NO-GO",
  );
  assert.equal(
    inferRecommendationFromVerdictSummary({ pass: 2, fail: 2, conditional: 1 }),
    "ITERATE",
  );
});

test("countVerdictLabels", () => {
  assert.deepEqual(
    countVerdictLabels([{ verdict: "PASS" }, { verdict: "CONDITIONAL" }, { verdict: "FAIL" }]),
    { pass: 1, fail: 1, conditional: 1 },
  );
});

test("revisePitchHref falls back to run anchor without workspace", () => {
  assert.equal(revisePitchHref(null, "run-9"), "/run/run-9#next-action");
});
