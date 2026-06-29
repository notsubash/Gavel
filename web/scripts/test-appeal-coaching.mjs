import assert from "node:assert/strict";
import test from "node:test";

import {
  appealEvidenceOutcome,
  appealJudgeOutcomes,
  normalizeTargetJudges,
} from "../src/lib/appeal/coaching.ts";

const BASELINE = {
  judge: "vc",
  verdict: "CONDITIONAL",
  roast: "Needs proof.",
  score: 4,
  key_concern: "No LOIs yet.",
  evidence_to_change_verdict: "Three signed LOIs would change this verdict.",
};

test("normalizeTargetJudges keeps panel order and drops unknown ids", () => {
  assert.deepEqual(normalizeTargetJudges(["customer", "vc", "unknown"]), ["vc", "customer"]);
  assert.deepEqual(normalizeTargetJudges(undefined), []);
});

test("appealEvidenceOutcome follows score delta", () => {
  assert.equal(
    appealEvidenceOutcome(BASELINE, { ...BASELINE, score: 6 }),
    "Evidence met",
  );
  assert.equal(
    appealEvidenceOutcome(BASELINE, { ...BASELINE, score: 4 }),
    "Not met",
  );
  assert.equal(
    appealEvidenceOutcome(
      { ...BASELINE, verdict: "PASS", score: 8 },
      { ...BASELINE, verdict: "PASS", score: 8 },
    ),
    "Already passing",
  );
});

test("appealJudgeOutcomes marks targeted judges", () => {
  const revised = { ...BASELINE, score: 6 };
  const outcomes = appealJudgeOutcomes([BASELINE], [revised], ["vc"]);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0]?.targeted, true);
  assert.equal(outcomes[0]?.outcome, "Evidence met");
});
