"use client";

import { useQuery } from "@tanstack/react-query";

import { getActivity, type ActivityResponse } from "@/lib/api/runs";
import { cn } from "@/lib/utils";
import {
  buildContributionWeeksFromCounts,
  LEVEL_CLASS,
  type ContributionDay,
} from "@/lib/marketing/contribution-graph";

const LEVEL_LABEL: Record<ContributionDay["level"], string> = {
  0: "no validation activity",
  1: "one validation action",
  2: "a few validation actions",
  3: "strong validation day",
  4: "heavy validation day",
};

function countsFromDays(days: { date: string; count: number }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const day of days) counts[day.date] = day.count;
  return counts;
}

export function ContributionGraph() {
  const query = useQuery<ActivityResponse>({
    queryKey: ["activity"],
    queryFn: getActivity,
    retry: 1,
    staleTime: 60_000,
  });

  const { weeks, total } = buildContributionWeeksFromCounts(
    countsFromDays(query.data?.days ?? []),
  );

  const signalLabel =
    query.isLoading ? "Loading…" : query.isError ? "Offline" : `${total} contributions`;

  return (
    <figure
      className="w-full min-w-0 rounded-ui border border-rule-soft bg-card p-4 shadow-soft sm:p-5"
      aria-labelledby="contribution-graph-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            id="contribution-graph-title"
            className="font-sans text-sm font-semibold text-ink"
          >
            Your Gavel trail
          </p>
          <p className="mt-1 max-w-lg font-sans text-sm text-ink-muted">
            A contribution is any validation move in Gavel: worksheet save, assumption,
            experiment, evidence, interview, or judge session. One square per day.
          </p>
        </div>
        <span className="rounded-ui border border-pass/30 bg-pass/10 px-2 py-1 font-mono text-xs font-semibold text-pass">
          {signalLabel}
        </span>
      </div>

      <div
        className="mt-5 flex gap-px"
        role="img"
        aria-label={
          total === 0
            ? "Gavel trail with no contributions yet."
            : `Gavel trail with ${total} contributions across the last year.`
        }
      >
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid min-w-0 flex-1 grid-rows-7 gap-px">
            {week.map((day) => (
              <span
                key={day.id}
                title={`${day.date}: ${day.count} action${day.count === 1 ? "" : "s"}`}
                className={cn(
                  "aspect-square min-w-0 rounded-[2px] border",
                  LEVEL_CLASS[day.level],
                )}
                aria-label={`${day.date}: ${
                  day.count === 0
                    ? LEVEL_LABEL[0]
                    : `${day.count} actions, ${LEVEL_LABEL[day.level]}`
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-ink-subtle">
        <span>
          {total === 0 && !query.isLoading
            ? "Start an idea in Gavel — contributions show up here."
            : "Evidence compounds before the roast."}
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={cn(
                "size-2.5 rounded-[2px] border",
                LEVEL_CLASS[level as ContributionDay["level"]],
              )}
              aria-hidden
            />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}
