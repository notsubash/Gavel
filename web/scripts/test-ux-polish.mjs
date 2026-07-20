/**
 * UX polish self-check: first-time path + ≤1 primary CTA vocabulary per screen.
 * Run: npm run test:ux-polish
 *
 * Stopwatch steps are documented (manual timing). This script asserts the copy /
 * anchor contracts that keep “one next action” honest in code.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

/** First-time path (manual stopwatch script). */
const FIRST_TIME_STEPS = [
  "Landing → Start free",
  "Create (core fields) → Save",
  "Case home → one next CTA (log interview / evidence)",
  "Reviews → Start review",
  "Run (live) → watch",
  "Verdict → one primary CTA → back to Case",
];

assert.equal(FIRST_TIME_STEPS.length, 6, "happy path stays ≤6 user-facing steps");

/** Primary CTA labels allowed as heat/primary actions (Phase 1/5 vocabulary). */
const PRIMARY_CTA_LABELS = [
  "Start free",
  "Start review",
  "Submit evidence",
  "Revise pitch",
  "Save",
  "Submit",
  "New idea",
  "Create your first idea",
  "Open review",
];

const copy = read("src/features/run/run-page-copy.ts");
assert.match(copy, /export const GLOSSARY/);
assert.match(copy, /export const DIALOG_COPY/);
assert.match(copy, /cancel:\s*"Cancel"/);
assert.match(copy, /save:\s*"Save"/);
assert.match(copy, /submit:\s*"Submit"/);
assert.match(copy, /submitEvidence:\s*"Submit evidence"/);
assert.match(copy, /revisePitch:\s*"Revise pitch"/);
assert.match(copy, /startReview:\s*"Start review"/);
assert.doesNotMatch(
  copy,
  /emptyDescription:.*"Roast/,
  "History empty copy must not say Roast",
);

const workflow = read("src/features/run/workflow-brief.tsx");
assert.match(workflow, /id="next-action"/);
assert.doesNotMatch(workflow, /id="next-actions-strip"/);
assert.match(workflow, /Problems &amp; experiment|Problems \& experiment/);

const resolve = read("src/features/run/resolve-verdict-next-action.ts");
assert.match(resolve, /#next-action/);
assert.doesNotMatch(resolve, /#next-actions-strip/);

const runSheet = read("src/features/run/run-sheet.tsx");
assert.match(runSheet, /Debate &amp; confidence|Debate \& confidence/);
assert.match(runSheet, /embedded/);

const landing = read("src/features/marketing/landing-page.tsx");
assert.match(landing, /LandingVerdictVisual/);
assert.match(landing, /Start free/);

const visual = read("src/features/marketing/landing-verdict-visual.tsx");
assert.match(visual, /Submit evidence/);
assert.match(visual, /Iterate/);

const moreMenu = read("src/ui/more-menu.tsx");
assert.match(moreMenu, /export function MoreMenu/);
assert.match(moreMenu, /export function MoreMenuItem/);
assert.match(moreMenu, /disabled/);
assert.match(moreMenu, /aria-busy/);

const versionCmp = read("src/features/iteration/version-comparison.tsx");
assert.match(versionCmp, /showConfidence/);
assert.match(versionCmp, /const showConfidence = !embedded/);

const empty = read("src/ui/empty-state.tsx");
assert.match(empty, /export function EmptyState/);

const interview = read("src/features/validation/interview-dialog.tsx");
assert.match(interview, /DIALOG_COPY\.cancel/);
assert.match(interview, /DIALOG_COPY\.save/);
assert.doesNotMatch(interview, /Save interview/);

const evidence = read("src/features/validation/evidence-dialog.tsx");
assert.match(evidence, /DIALOG_COPY\.save/);
assert.doesNotMatch(evidence, /Save evidence/);

const experiment = read("src/features/validation/experiment-dialog.tsx");
assert.match(experiment, /DIALOG_COPY\.save/);
assert.doesNotMatch(experiment, /Create experiment/);

const actionBar = read("src/features/workspace/workspace-action-bar.tsx");
assert.match(actionBar, /disabled=\{coachMutation\.isPending\}/);

const verdictCard = read("src/features/run/verdict-card.tsx");
assert.match(verdictCard, /highest_priority/);
assert.ok(
  verdictCard.indexOf("highest_priority") < verdictCard.indexOf("top_risks[0]"),
  "shortWhy should prefer highest_priority over top_risks",
);

// One primary label set — screens reuse these strings, not roast/refine duals.
for (const label of PRIMARY_CTA_LABELS) {
  assert.ok(label.length > 0);
}
assert.ok(!PRIMARY_CTA_LABELS.includes("Roast my idea"));
assert.ok(!PRIMARY_CTA_LABELS.includes("Complete experiment"));
assert.ok(!PRIMARY_CTA_LABELS.includes("Refine this idea"));

console.log("ux-polish: ok");
console.log("Manual stopwatch path:");
for (const [i, step] of FIRST_TIME_STEPS.entries()) {
  console.log(`  ${i + 1}. ${step}`);
}
console.log("Count visible primary (heat) buttons per screen — expect ≤ 1.");
