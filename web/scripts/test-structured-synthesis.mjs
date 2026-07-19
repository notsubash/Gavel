import assert from "node:assert/strict";
import test from "node:test";

import {
  collectRecommendedFixes,
  deriveNextActions,
  deriveWorkflowBrief,
  parseStructuredSynthesis,
  topPriorities,
} from "../src/features/run/structured-synthesis.ts";
import { assessRevoteOutputQuality } from "../src/features/run/verdict-quality.ts";

const STRUCTURED = {
  overall_recommendation: "ITERATE",
  confidence: "MEDIUM",
  top_strengths: ["Clear pain point."],
  top_risks: ["No buyer proof yet.", "Long sales cycles."],
  top_problems: ["No buyer proof yet.", "Long sales cycles.", "Unclear wedge."],
  highest_priority: "Validate that compliance leads will pay before building more workflow.",
  biggest_disagreement: "VC and PM disagree on wedge size.",
  recommended_experiment: {
    title: "Run five buyer interviews with compliance leads.",
    audience: "Compliance leads at mid-size hospitals",
    hypothesis: "Buyers rank audit prep as a top-three weekly pain.",
    questions: [
      "Do they rank audit prep unprompted?",
      "What tools do they use today?",
      "Would they pilot a one-hour-saving workflow?",
    ],
    effort_minutes: 120,
  },
};

const KEYBOARD_STRUCTURED = {
  overall_recommendation: "NO-GO",
  confidence: "HIGH",
  top_strengths: [],
  top_risks: [
    "Every single judge independently concluded this product fails as a venture investment.",
    "Zero switching costs and no software lock-in mean every sale is a one-off transaction.",
    "The core user behavior requires looking down at keys, undermining touch-typing.",
  ],
  top_problems: [
    "Zero switching costs and no software lock-in mean every sale is a one-off transaction.",
    "The core user behavior requires looking down at keys, undermining touch-typing.",
    "No validated ICP experiences wrong keycap legend pain as costly enough to buy.",
  ],
  biggest_disagreement: "VC vs Engineer on strategic vs operational fatal flaw.",
};

test("parseStructuredSynthesis reads top_problems and recommended_experiment", () => {
  const parsed = parseStructuredSynthesis(STRUCTURED);
  assert.equal(parsed?.top_problems.length, 3);
  assert.equal(parsed?.recommended_experiment?.title, STRUCTURED.recommended_experiment.title);
});

test("deriveWorkflowBrief prefers structured top_problems over top_risks", () => {
  const brief = deriveWorkflowBrief(null, KEYBOARD_STRUCTURED, []);
  assert.equal(brief.problems.length, 3);
  assert.doesNotMatch(brief.problems[0], /Every single judge/i);
  assert.match(brief.problems[0], /Zero switching costs/i);
});

test("deriveWorkflowBrief uses highest_priority instead of biggest_disagreement", () => {
  const brief = deriveWorkflowBrief(null, STRUCTURED, []);
  assert.equal(
    brief.blocker,
    "Validate that compliance leads will pay before building more workflow.",
  );
  assert.equal(brief.problems.length, 3);
  assert.notEqual(brief.blocker, STRUCTURED.biggest_disagreement);
});

test("deriveWorkflowBrief hides blocker when highest_priority is missing", () => {
  const brief = deriveWorkflowBrief(
    null,
    {
      ...STRUCTURED,
      highest_priority: null,
    },
    [],
  );
  assert.equal(brief.blocker, null);
  assert.equal(brief.problems.length, 3);
});

test("topPriorities prefers top_problems", () => {
  const parsed = parseStructuredSynthesis(STRUCTURED);
  assert.ok(parsed);
  assert.deepEqual(
    topPriorities(parsed, ["ignored fix"]),
    STRUCTURED.top_problems,
  );
});

test("deriveNextActions falls back to judge key concerns without structured synthesis", () => {
  const verdicts = [
    {
      judge: "pm",
      verdict: "FAIL",
      score: 2,
      key_concern: "No validated ICP.",
      recommended_fix: "Interview ten buyers.",
    },
  ];
  assert.deepEqual(deriveNextActions(null, null, verdicts), ["No validated ICP."]);
});

test("collectRecommendedFixes ranks FAIL before PASS", () => {
  const fixes = collectRecommendedFixes([
    { verdict: "PASS", score: 8, recommended_fix: "Ship faster." },
    { verdict: "FAIL", score: 2, recommended_fix: "Prove demand." },
  ]);
  assert.deepEqual(fixes, ["Prove demand.", "Ship faster."]);
});

function verdict(judge, score) {
  return {
    judge,
    verdict: "CONDITIONAL",
    roast: "Needs work.",
    score,
    key_concern: "Gap.",
    recommended_fix: `Fix for ${judge}.`,
  };
}

test("assessRevoteOutputQuality treats varied same-direction moves as convergence", () => {
  const baseline = {
    vc: verdict("vc", 7),
    pm: verdict("pm", 7),
    customer: verdict("customer", 6),
    competitor: verdict("competitor", 5),
    engineer: verdict("engineer", 6),
  };
  const current = [
    verdict("vc", 5),
    verdict("pm", 6),
    verdict("customer", 5),
    verdict("competitor", 3),
    verdict("engineer", 6),
  ];
  const quality = assessRevoteOutputQuality(baseline, current);
  assert.equal(quality.panelConverged, true);
});
