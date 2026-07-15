import assert from "node:assert/strict";

import {
  buildContributionWeeks,
  CONTRIBUTION_DAYS,
  DEFAULT_CONTRIBUTION_WEEKS,
} from "../src/lib/marketing/contribution-graph.ts";

const seed = 0x6a617679;
const weeks = buildContributionWeeks(seed);

assert.equal(weeks.length, DEFAULT_CONTRIBUTION_WEEKS);

for (const [weekIndex, week] of weeks.entries()) {
  assert.equal(week.length, CONTRIBUTION_DAYS);

  for (const [dayIndex, day] of week.entries()) {
    assert.equal(day.week, weekIndex);
    assert.equal(day.day, dayIndex);
    assert.match(day.id, /^\d+-\d+$/);
    assert.ok(day.level >= 0 && day.level <= 4);
  }
}

assert.deepEqual(buildContributionWeeks(seed), weeks);
assert.notDeepEqual(buildContributionWeeks(seed + 1), weeks);

console.log("Contribution graph checks passed");
