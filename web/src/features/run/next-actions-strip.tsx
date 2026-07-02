"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { secondaryCtaClass } from "@/lib/cta-classes";
import type { Experiment } from "@/lib/experiment/experiment";
import { cn } from "@/lib/utils";

import { RUN_PAGE_COPY } from "./run-page-copy";

/** Today's goal — experiment focus + refine CTA. Problems live in WorkflowBrief. */
export function NextActionsStrip({
  runId,
  experiment,
  completed,
  className,
}: {
  runId: string;
  experiment: Experiment;
  completed: boolean;
  className?: string;
}) {
  return (
    <section
      id="next-actions-strip"
      className={cn("mt-5 border border-rule-soft bg-paper-2", className)}
      aria-labelledby="next-actions-heading"
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4 border-b border-rule-soft px-4 py-3 sm:px-5">
        <h3
          id="next-actions-heading"
          className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
        >
          {RUN_PAGE_COPY.todaysGoal}
        </h3>
        <div
          className={cn(
            "flex flex-wrap gap-2",
            !completed && "invisible pointer-events-none",
          )}
          aria-hidden={!completed}
        >
          <Link href={`/?refine=${runId}`} className={secondaryCtaClass} tabIndex={completed ? 0 : -1}>
            {RUN_PAGE_COPY.refineIdea}
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <p className="font-sans text-sm font-semibold leading-relaxed text-ink">{experiment.title}</p>
        <p className="mt-1.5 font-sans text-sm leading-relaxed text-ink-muted">
          {experiment.hypothesis}
        </p>
      </div>
    </section>
  );
}
