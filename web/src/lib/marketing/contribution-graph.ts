export type ContributionDay = {
  id: string;
  date: string;
  day: number;
  week: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type ContributionWeek = ContributionDay[];

export const CONTRIBUTION_DAYS = 7;
export const DEFAULT_CONTRIBUTION_WEEKS = 53;

export const LEVEL_CLASS: Record<ContributionDay["level"], string> = {
  0: "border-rule-soft bg-paper-2",
  1: "border-pass/15 bg-pass/15",
  2: "border-pass/20 bg-pass/30",
  3: "border-pass/30 bg-pass/55",
  4: "border-pass bg-pass",
};

export function levelFromCount(count: number): ContributionDay["level"] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Build a GitHub-style calendar from YYYY-MM-DD → count. */
export function buildContributionWeeksFromCounts(
  counts: Record<string, number>,
  weeks = DEFAULT_CONTRIBUTION_WEEKS,
  today = new Date(),
): { weeks: ContributionWeek[]; total: number } {
  const end = startOfUtcDay(today);
  // Align the window to full Sun–Sat columns ending this week (GitHub-style).
  const endSaturday = new Date(end);
  endSaturday.setUTCDate(endSaturday.getUTCDate() + (6 - endSaturday.getUTCDay()));
  const start = new Date(endSaturday);
  start.setUTCDate(start.getUTCDate() - (weeks * CONTRIBUTION_DAYS - 1));

  const grid: ContributionWeek[] = [];
  let cursor = new Date(start);
  let total = 0;

  for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
    const week: ContributionDay[] = [];
    for (let day = 0; day < CONTRIBUTION_DAYS; day++) {
      const date = utcDayKey(cursor);
      const future = cursor.getTime() > end.getTime();
      const count = future ? 0 : (counts[date] ?? 0);
      if (!future) total += count;
      week.push({
        id: date,
        date,
        day,
        week: weekIndex,
        count,
        level: future ? 0 : levelFromCount(count),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    grid.push(week);
  }

  return { weeks: grid, total };
}
