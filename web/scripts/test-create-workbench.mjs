import assert from "node:assert/strict";

/** Inline mirror of create/disclosure helpers (no TS path aliases). */
const CREATE_CORE = [
  "working_name",
  "audience",
  "problem_statement",
  "solution_statement",
  "top_risky_assumption",
];

const DEFERRED_PLACEHOLDERS = {
  current_workaround: "Not captured yet.",
  secret_sauce: "Not captured yet.",
  disconfirming_evidence: "Not captured yet.",
};

const ASSUMPTION_BOARD_THRESHOLD = 5;

function isCreateCoreField(name) {
  return CREATE_CORE.includes(name);
}

const WORKSHEET_DEFAULTS = {
  working_name: "",
  audience: "",
  problem_statement: "",
  current_workaround: "",
  solution_statement: "",
  secret_sauce: "",
  pricing_hypothesis: "unknown",
  existing_evidence: "none yet",
  competitors: [],
  top_risky_assumption: "",
  disconfirming_evidence: "",
  trigger_event: null,
};

function fillDeferredPlaceholders(data) {
  const next = {
    ...WORKSHEET_DEFAULTS,
    ...data,
    competitors: Array.isArray(data.competitors) ? data.competitors : [],
  };
  for (const [key, placeholder] of Object.entries(DEFERRED_PLACEHOLDERS)) {
    const value = typeof next[key] === "string" ? next[key].trim() : "";
    if (!value || value.length < 10 || /^not captured yet\.?$/i.test(value)) {
      next[key] = placeholder;
    }
  }
  if (!next.pricing_hypothesis?.trim()) next.pricing_hypothesis = "unknown";
  if (!next.existing_evidence?.trim()) next.existing_evidence = "none yet";
  return next;
}

function stripDeferredPlaceholders(data) {
  const next = { ...data };
  for (const key of Object.keys(DEFERRED_PLACEHOLDERS)) {
    if (typeof next[key] === "string" && /^not captured yet\.?$/i.test(next[key].trim())) {
      next[key] = "";
    }
  }
  return next;
}

function displayWorksheetField(value) {
  const text = (value ?? "").trim();
  if (!text) return "…";
  if (/^(not captured yet\.?|none yet\.?|unknown)$/i.test(text)) return "…";
  return text;
}

function isWeakFieldValue(value) {
  const text = value.trim();
  if (!text) return false;
  if (/^(not captured yet\.?|none yet\.?|unknown)$/i.test(text)) return true;
  return text.length < 80;
}

function shouldUseAssumptionBoard(count) {
  return count > ASSUMPTION_BOARD_THRESHOLD;
}

assert.equal(CREATE_CORE.length, 5);
assert.ok(isCreateCoreField("audience"));
assert.equal(isCreateCoreField("secret_sauce"), false);

const filled = fillDeferredPlaceholders({
  working_name: "Acme",
  audience: "Founders building B2B tools weekly.",
  problem_statement: "Cannot prove demand before building.",
  current_workaround: "",
  solution_statement: "I am building a case workbench for founders.",
  secret_sauce: "",
  pricing_hypothesis: "",
  existing_evidence: "",
  competitors: [],
  top_risky_assumption: "Founders will return after the first review.",
  disconfirming_evidence: "",
});

assert.equal(filled.current_workaround, "Not captured yet.");
assert.equal(filled.secret_sauce, "Not captured yet.");
assert.equal(filled.disconfirming_evidence, "Not captured yet.");
assert.equal(filled.pricing_hypothesis, "unknown");
assert.equal(filled.existing_evidence, "none yet");
assert.ok(filled.current_workaround.length >= 10);

// Core-only submit (unmounted detail fields omitted) must still produce a valid payload.
const coreOnly = fillDeferredPlaceholders({
  working_name: "Acme",
  audience: "Founders building B2B tools weekly.",
  problem_statement: "Cannot prove demand before building.",
  solution_statement: "I am building a case workbench for founders.",
  top_risky_assumption: "Founders will return after the first review.",
});
assert.equal(coreOnly.current_workaround, "Not captured yet.");
assert.equal(coreOnly.secret_sauce, "Not captured yet.");
assert.equal(coreOnly.disconfirming_evidence, "Not captured yet.");
assert.equal(coreOnly.pricing_hypothesis, "unknown");
assert.equal(coreOnly.existing_evidence, "none yet");
assert.deepEqual(coreOnly.competitors, []);

const shortStub = fillDeferredPlaceholders({
  ...filled,
  current_workaround: "hi",
  secret_sauce: "short",
  disconfirming_evidence: "nope",
});
assert.equal(shortStub.current_workaround, "Not captured yet.");
assert.equal(shortStub.secret_sauce, "Not captured yet.");
assert.equal(shortStub.disconfirming_evidence, "Not captured yet.");

const stripped = stripDeferredPlaceholders({
  ...filled,
  current_workaround: "Not captured yet.",
  secret_sauce: "Real sauce that is long enough.",
});
assert.equal(stripped.current_workaround, "");
assert.equal(stripped.secret_sauce, "Real sauce that is long enough.");
assert.equal(displayWorksheetField("Not captured yet."), "…");
assert.equal(displayWorksheetField("A real audience description."), "A real audience description.");

assert.equal(isWeakFieldValue("short pitch"), true);
assert.equal(isWeakFieldValue("Not captured yet."), true);
assert.equal(
  isWeakFieldValue(
    "A deliberately longer audience description that should not look weak after the founder has written enough detail to stand alone.",
  ),
  false,
);
assert.equal(isWeakFieldValue(""), false);

assert.equal(shouldUseAssumptionBoard(5), false);
assert.equal(shouldUseAssumptionBoard(6), true);

console.log("create-workbench: ok");
