import { cn } from "@/lib/utils";
import {
  buildContributionWeeks,
  LEVEL_CLASS,
  type ContributionDay,
} from "@/lib/marketing/contribution-graph";

const LEVEL_LABEL: Record<ContributionDay["level"], string> = {
  0: "no validation activity",
  1: "one small validation action",
  2: "several validation actions",
  3: "strong validation push",
  4: "panel-ready validation sprint",
};

export function ContributionGraph() {
  const weeks = buildContributionWeeks(0x6a617679);

  return (
    <figure
      className="min-w-0 rounded-ui border border-rule-soft bg-card p-4 shadow-soft sm:p-5"
      aria-labelledby="contribution-graph-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            id="contribution-graph-title"
            className="font-sans text-sm font-semibold text-ink"
          >
            Validation action board
          </p>
          <p className="mt-1 max-w-md font-sans text-sm text-ink-muted">
            Every square is an idea, interview, experiment, or judge ask moving toward a
            verdict.
          </p>
        </div>
        <span className="rounded-ui border border-pass/30 bg-pass/10 px-2 py-1 font-mono text-xs font-semibold text-pass">
          371 signals
        </span>
      </div>

      <div
        className="mt-5 overflow-x-auto pb-2"
        role="img"
        aria-label="A GitHub-style contribution graph showing steady validation activity across 53 weeks."
      >
        <div className="flex w-max gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-rows-7 gap-1">
              {week.map((day) => (
                <span
                  key={day.id}
                  className={cn(
                    "size-3 rounded-[3px] border",
                    LEVEL_CLASS[day.level],
                  )}
                  aria-label={`Week ${day.week + 1}, day ${day.day + 1}: ${
                    LEVEL_LABEL[day.level]
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <figcaption className="mt-4 flex items-center justify-between gap-3 font-sans text-xs text-ink-subtle">
        <span>Evidence compounds before the roast.</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={cn(
                "size-3 rounded-[3px] border",
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
