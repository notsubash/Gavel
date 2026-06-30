import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_RUN_FOLD_VARIANT,
  foldVariantToQueryFlag,
  formatFoldSectionOrder,
  parseFoldQueryParam,
  resolveRunFoldVariant,
  RUN_FOLD_ORDERS,
  RUN_FOLD_VARIANTS,
} from "../src/features/run/run-fold-layout.ts";

test("parseFoldQueryParam maps lightweight A/B flags", () => {
  assert.equal(parseFoldQueryParam("a"), "panel-first");
  assert.equal(parseFoldQueryParam("b"), "iterate-first");
  assert.equal(parseFoldQueryParam("B"), "iterate-first");
  assert.equal(parseFoldQueryParam("nope"), null);
});

test("resolveRunFoldVariant prefers URL over storage then default", () => {
  assert.equal(resolveRunFoldVariant("a", "b"), "panel-first");
  assert.equal(resolveRunFoldVariant(null, "iterate-first"), "iterate-first");
  assert.equal(resolveRunFoldVariant(undefined, null), DEFAULT_RUN_FOLD_VARIANT);
});

test("resolveRunFoldVariant reads stored variant names not query flags", () => {
  assert.equal(resolveRunFoldVariant(null, "panel-first"), "panel-first");
  assert.equal(resolveRunFoldVariant(null, "iterate-first"), "iterate-first");
});

test("foldVariantToQueryFlag round-trips through parseFoldQueryParam", () => {
  for (const variant of Object.keys(RUN_FOLD_VARIANTS)) {
    assert.equal(parseFoldQueryParam(foldVariantToQueryFlag(variant)), variant);
  }
});

test("iterate-first places version comparison before judge panel", () => {
  const order = RUN_FOLD_ORDERS["iterate-first"];
  assert.ok(order.indexOf("version") < order.indexOf("judges"));
});

test("panel-first keeps judge panel before version comparison", () => {
  const order = RUN_FOLD_ORDERS["panel-first"];
  assert.ok(order.indexOf("judges") < order.indexOf("version"));
});

test("formatFoldSectionOrder lists human-readable steps", () => {
  const steps = formatFoldSectionOrder("iterate-first");
  assert.ok(steps[0].includes("Decision"));
  const versionIdx = steps.findIndex((s) => s.includes("Version"));
  const panelIdx = steps.findIndex((s) => s.includes("Full roast"));
  assert.ok(versionIdx < panelIdx);
});

test("both variants share the same trailing utility sections", () => {
  for (const variant of ["panel-first", "iterate-first"]) {
    const order = RUN_FOLD_ORDERS[variant];
    assert.deepEqual(order.slice(-2), ["transcript", "context"]);
  }
});
