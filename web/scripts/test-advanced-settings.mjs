import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
} from "../src/lib/settings/advanced-settings.ts";

test("DEFAULT_ADVANCED_SETTINGS matches founder-friendly defaults", () => {
  assert.equal(DEFAULT_ADVANCED_SETTINGS.run_fold_variant, "iterate-first");
  assert.equal(DEFAULT_ADVANCED_SETTINGS.model_runtime, "deepseek");
  assert.equal(DEFAULT_ADVANCED_SETTINGS.max_debate_rounds, 3);
  assert.equal(DEFAULT_ADVANCED_SETTINGS.enable_web_search, false);
});

test("normalizeAdvancedSettings clamps debate rounds and fold names", () => {
  const normalized = normalizeAdvancedSettings({
    max_debate_rounds: 99,
    run_fold_variant: "panel-first",
    model_runtime: "local",
    enable_web_search: true,
  });
  assert.equal(normalized.max_debate_rounds, 5);
  assert.equal(normalized.run_fold_variant, "panel-first");
  assert.equal(normalized.model_runtime, "local");
  assert.equal(normalized.enable_web_search, true);
});

test("normalizeAdvancedSettings rejects invalid fold with default", () => {
  const normalized = normalizeAdvancedSettings({ run_fold_variant: "bogus" });
  assert.equal(normalized.run_fold_variant, "iterate-first");
});
