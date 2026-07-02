import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveExperiment,
  experimentIdForRun,
  formatExperimentLegacy,
  nextExperimentStatus,
  resolveExperimentStatus,
} from "../src/lib/experiment/experiment.ts";

const KEYBOARD_VERDICTS = [
  {
    judge: "pm",
    verdict: "FAIL",
    score: 2,
    key_concern: "No evidence that any target user segment experiences the wrong keycap legend pain.",
    recommended_fix:
      "Run 15 structured interviews with video editors who own Stream Decks and ask them to timeline their workflow friction points.",
    evidence_to_change_verdict:
      "Show me ten interview transcripts where a clearly defined ICP names forgetting keybindings as a top-three frustration.",
  },
];

const STRUCTURED_WITH_EXPERIMENT = {
  overall_recommendation: "NO-GO",
  confidence: "HIGH",
  top_strengths: ["Visually appealing novelty."],
  top_risks: ["Every single judge independently concluded this product fails."],
  top_problems: [
    "Zero switching costs mean every sale is a one-off transaction with no repeat revenue.",
    "Looking down at keys undermines touch-typing muscle memory for power users.",
    "No validated ICP experiences wrong keycap legend pain as costly enough to buy.",
  ],
  biggest_disagreement: "VC vs Engineer on strategic vs operational fatal flaw.",
  recommended_experiment: {
    title: "Run 15 structured interviews with video editors who own Stream Decks.",
    audience: "Video editors who own Stream Decks",
    hypothesis: "Editors rank forgotten shortcuts across apps as a top-three workflow pain.",
    questions: [
      "Do they rank shortcut friction in their top three pains unprompted?",
      "How often do they switch NLEs mid-task?",
      "Would they pay for a hardware fix versus a software overlay?",
    ],
    effort_minutes: 120,
  },
};

test("deriveExperiment reads moderator recommended_experiment structured output", () => {
  const experiment = deriveExperiment(
    "7cbd5814-45ca-447b-82f7-63f77820bdb1",
    null,
    STRUCTURED_WITH_EXPERIMENT,
    KEYBOARD_VERDICTS,
  );

  assert.equal(experiment.title, STRUCTURED_WITH_EXPERIMENT.recommended_experiment.title);
  assert.equal(experiment.audience, "Video editors who own Stream Decks");
  assert.match(experiment.questions[0], /unprompted/i);
  assert.equal(experiment.effortMinutes, 120);
  assert.equal(experiment.sourceJudge, null);
});

test("deriveExperiment legacy fallback uses first judge fix when structured experiment missing", () => {
  const structured = {
    overall_recommendation: "NO-GO",
    confidence: "HIGH",
    top_problems: ["Zero switching costs block repeat revenue."],
    biggest_disagreement: "Split on wedge.",
  };
  const experiment = deriveExperiment("run-1", null, structured, KEYBOARD_VERDICTS);
  assert.match(experiment.title, /15 structured interviews/i);
});

test("deriveExperiment falls back to generic when no structured or verdict data", () => {
  const experiment = deriveExperiment("abc-123", null, null, []);
  assert.match(experiment.title, /customer discovery/i);
  assert.equal(experiment.questions.length, 3);
});

test("experiment status transitions", () => {
  assert.equal(nextExperimentStatus("suggested", "start"), "in_progress");
  assert.equal(
    resolveExperimentStatus(
      deriveExperiment("run-1", null, STRUCTURED_WITH_EXPERIMENT, KEYBOARD_VERDICTS),
      { hasAppeal: true },
    ).status,
    "reviewed",
  );
});

test("experimentIdForRun is stable prefix", () => {
  assert.equal(experimentIdForRun("7cbd5814-45ca-447b-82f7-63f77820bdb1"), "exp-7cbd5814");
});

test("formatExperimentLegacy includes title and effort", () => {
  const experiment = deriveExperiment("run-1", null, STRUCTURED_WITH_EXPERIMENT, KEYBOARD_VERDICTS);
  const legacy = formatExperimentLegacy(experiment);
  assert.match(legacy, /15 structured interviews/i);
});
