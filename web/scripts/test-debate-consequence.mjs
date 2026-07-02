import assert from "node:assert/strict";
import test from "node:test";

import { deriveDebateConsequence } from "../src/lib/debate/debate-consequence.ts";
import { judgeStanceLabel } from "../src/lib/sse/judge-stance.ts";

const BASELINE = {
  judge: "vc",
  verdict: "FAIL",
  roast: "Too early.",
  score: 3,
  key_concern: "No buyer proof.",
  recommended_fix: "Interview buyers.",
  evidence_to_change_verdict: "Three LOIs.",
};

const REVISED = {
  ...BASELINE,
  score: 5,
  verdict: "CONDITIONAL",
  key_concern: "Wedge is plausible if proof lands.",
  evidence_to_change_verdict: "Engineer shifted my read on feasibility.",
};

test("deriveDebateConsequence surfaces disagreement, movement, and unresolved risk", () => {
  const result = deriveDebateConsequence({
    structuredSynthesis: {
      overall_recommendation: "ITERATE",
      confidence: "MEDIUM",
      biggest_disagreement: "VC and PM disagree on wedge size.",
      highest_priority: "Validate compliance leads will pay.",
      top_problems: ["No buyer proof."],
    },
    synthesisProse: null,
    verdicts: [REVISED],
    revoteBaseline: { vc: BASELINE },
    revoteChangeReasons: { vc: "Engineer shifted my read on feasibility." },
    topProblems: ["No buyer proof."],
  });

  assert.ok(result);
  assert.match(result.disagreement ?? "", /VC and PM/);
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0].fromScore, 3);
  assert.equal(result.movements[0].toScore, 5);
  assert.match(result.unresolvedRisk ?? "", /Validate compliance/);
  assert.equal(result.scoresMoved, true);
});

test("deriveDebateConsequence returns null when nothing to show", () => {
  const result = deriveDebateConsequence({
    structuredSynthesis: null,
    synthesisProse: null,
    verdicts: [BASELINE],
    revoteBaseline: {},
    revoteChangeReasons: {},
  });
  assert.equal(result, null);
});

test("deriveDebateConsequence uses verdict evidence ask when change reason missing", () => {
  const result = deriveDebateConsequence({
    structuredSynthesis: {
      overall_recommendation: "ITERATE",
      confidence: "MEDIUM",
      biggest_disagreement: "VC vs PM on wedge.",
      top_problems: ["No proof."],
    },
    synthesisProse: null,
    verdicts: [REVISED],
    revoteBaseline: { vc: BASELINE },
    revoteChangeReasons: {},
    topProblems: ["No proof."],
  });
  assert.ok(result);
  assert.equal(result.movements[0].reason, REVISED.evidence_to_change_verdict);
});

test("judgeStanceLabel maps verdict labels", () => {
  assert.equal(judgeStanceLabel("PASS"), "Bullish");
  assert.equal(judgeStanceLabel("CONDITIONAL"), "Cautious");
  assert.equal(judgeStanceLabel("FAIL"), "Skeptical");
});
