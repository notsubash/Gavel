import assert from "node:assert/strict";

import {
  buildContributionWeeksFromCounts,
  CONTRIBUTION_DAYS,
  DEFAULT_CONTRIBUTION_WEEKS,
  levelFromCount,
  utcDayKey,
} from "../src/lib/marketing/contribution-graph.ts";

assert.equal(levelFromCount(0), 0);
assert.equal(levelFromCount(1), 1);
assert.equal(levelFromCount(3), 2);
assert.equal(levelFromCount(6), 3);
assert.equal(levelFromCount(7), 4);

const today = new Date(Date.UTC(2026, 6, 15)); // 2026-07-15
const todayKey = utcDayKey(today);
const counts = {
  [todayKey]: 4,
  "2026-07-14": 1,
  "2026-01-01": 9,
};

const { weeks, total } = buildContributionWeeksFromCounts(counts, DEFAULT_CONTRIBUTION_WEEKS, today);

assert.equal(weeks.length, DEFAULT_CONTRIBUTION_WEEKS);
assert.equal(total, 14);

for (const [weekIndex, week] of weeks.entries()) {
  assert.equal(week.length, CONTRIBUTION_DAYS);
  for (const [dayIndex, day] of week.entries()) {
    assert.equal(day.week, weekIndex);
    assert.equal(day.day, dayIndex);
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(day.level >= 0 && day.level <= 4);
  }
}

const todayCell = weeks.flat().find((day) => day.date === todayKey);
assert.ok(todayCell);
assert.equal(todayCell.count, 4);
assert.equal(todayCell.level, 3);

const empty = buildContributionWeeksFromCounts({}, 4, today);
assert.equal(empty.total, 0);
assert.equal(empty.weeks.length, 4);

console.log("Contribution graph checks passed");
