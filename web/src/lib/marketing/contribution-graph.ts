export type ContributionDay = {
  id: string;
  day: number;
  week: number;
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

function nextRandom(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function levelFor(value: number, week: number, day: number): ContributionDay["level"] {
  const normalized = value / 0xffffffff;
  const lateMomentum = week > 34 && day % 2 === 0 ? 0.08 : 0;
  const trialSpike = (week === 11 || week === 29 || week === 43) && day > 1 ? 0.18 : 0;
  const score = Math.min(normalized + lateMomentum + trialSpike, 1);

  if (score > 0.9) return 4;
  if (score > 0.72) return 3;
  if (score > 0.5) return 2;
  if (score > 0.28) return 1;
  return 0;
}

export function buildContributionWeeks(
  seed: number,
  weeks = DEFAULT_CONTRIBUTION_WEEKS,
): ContributionWeek[] {
  let state = seed >>> 0;

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: CONTRIBUTION_DAYS }, (_, day) => {
      state = nextRandom(state + week + day);
      return {
        id: `${week}-${day}`,
        day,
        week,
        level: levelFor(state, week, day),
      };
    }),
  );
}
