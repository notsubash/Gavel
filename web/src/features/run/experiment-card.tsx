"use client";

import { Clock, FlaskConical, Users } from "lucide-react";

import {
  EXPERIMENT_STATUS_LABELS,
  formatEffort,
  type Experiment,
} from "@/lib/experiment/experiment";
import { cn } from "@/lib/utils";

import { RUN_PAGE_COPY } from "./run-page-copy";

const STATUS_CLASS: Record<Experiment["status"], string> = {
  suggested: "bg-paper-2 text-ink-muted",
  in_progress: "bg-ai/10 text-ai",
  submitted: "bg-conditional/10 text-conditional",
  reviewed: "bg-pass/10 text-pass",
};

export function ExperimentCard({
  experiment,
  className,
}: {
  experiment: Experiment;
  className?: string;
}) {
  return (
    <section
      className={cn("border border-rule-soft bg-card", className)}
      aria-labelledby="experiment-heading"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <h3
            id="experiment-heading"
            className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
          >
            {RUN_PAGE_COPY.recommendedExperiment}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold",
            STATUS_CLASS[experiment.status],
          )}
        >
          {EXPERIMENT_STATUS_LABELS[experiment.status]}
        </span>
      </header>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="font-sans text-sm font-semibold leading-snug text-ink">{experiment.title}</p>
          <p className="mt-1.5 font-sans text-sm leading-relaxed text-ink-muted">
            {experiment.hypothesis}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {RUN_PAGE_COPY.experimentAudience}
              </dt>
              <dd className="mt-0.5 font-sans text-sm text-ink">{experiment.audience}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {RUN_PAGE_COPY.experimentEffort}
              </dt>
              <dd className="mt-0.5 font-sans text-sm text-ink">
                {formatEffort(experiment.effortMinutes)}
              </dd>
            </div>
          </div>
        </dl>

        {experiment.questions.length > 0 && (
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {RUN_PAGE_COPY.experimentQuestions}
            </p>
            <ol className="mt-2 list-none space-y-2" aria-label="Suggested validation questions">
              {experiment.questions.map((question, index) => (
                <li
                  key={index}
                  className="flex gap-2 font-sans text-sm leading-relaxed text-ink"
                >
                  <span className="w-5 shrink-0 font-mono text-xs font-bold text-ink-muted" aria-hidden>
                    {index + 1}.
                  </span>
                  {question}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

/** Plain-text fallback when experiment entity flag is off. */
export function ExperimentLegacyText({
  experiment,
  className,
}: {
  experiment: Experiment;
  className?: string;
}) {
  return (
    <section
      className={cn("flex items-start gap-3 border border-rule-soft bg-card px-4 py-3", className)}
      aria-labelledby="experiment-heading"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
      <div>
        <h3
          id="experiment-heading"
          className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
        >
          {RUN_PAGE_COPY.recommendedExperiment}
        </h3>
        <p className="mt-2 font-sans text-sm leading-relaxed text-ink">{experiment.title}</p>
      </div>
    </section>
  );
}
