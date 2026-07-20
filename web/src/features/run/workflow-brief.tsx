"use client";

import Link from "next/link";
import { ClipboardList, Target } from "lucide-react";

import { heatCtaClass } from "@/lib/cta-classes";
import type { Experiment } from "@/lib/experiment/experiment";
import type { Verdict } from "@/lib/sse/types";
import { cn } from "@/lib/utils";
import { DisclosureChevron } from "@/ui/disclosure-chevron";
import { MoreMenu, MoreMenuItem } from "@/ui/more-menu";

import { ExperimentCard } from "./experiment-card";
import { RUN_PAGE_COPY } from "./run-page-copy";
import {
  countVerdictLabels,
  resolveVerdictNextAction,
  revisePitchHref,
} from "./resolve-verdict-next-action";
import {
  deriveWorkflowBrief,
  parseDecisionVerdictProse,
  parseStructuredSynthesis,
  type OverallRecommendation,
} from "./structured-synthesis";

const cardClass = "surface-flat";

export function WorkflowBrief({
  synthesisProse,
  structuredSynthesis,
  verdicts,
  experiment,
  completed,
  evidenceLink,
  evidenceReplayPending = false,
  onCompleteExperiment,
  runId,
  workspaceId,
  className,
}: {
  synthesisProse: string | null;
  structuredSynthesis: unknown;
  verdicts: Verdict[];
  experiment: Experiment;
  completed: boolean;
  evidenceLink?: { href: string; label: string; useModal?: boolean } | null;
  evidenceReplayPending?: boolean;
  onCompleteExperiment?: () => void;
  runId?: string;
  workspaceId?: string | null;
  className?: string;
}) {
  const { problems, blocker } = deriveWorkflowBrief(
    synthesisProse,
    structuredSynthesis,
    verdicts,
  );
  const hasContent = problems.length > 0 || blocker || completed;

  if (!hasContent) return null;

  const structured =
    parseStructuredSynthesis(structuredSynthesis) ??
    (synthesisProse ? parseDecisionVerdictProse(synthesisProse) : null);
  const recommendation: OverallRecommendation | null =
    structured?.overall_recommendation ?? null;
  const verdictSummary = countVerdictLabels(verdicts);

  const primary =
    completed && runId
      ? resolveVerdictNextAction({
          runId,
          workspaceId,
          recommendation,
          verdictSummary: recommendation ? null : verdictSummary,
          evidenceSubmitted: Boolean(evidenceLink && !evidenceLink.useModal),
        })
      : null;

  // Can't open evidence modal without baseline — fall back to revise / open review.
  const resolvedPrimary =
    primary?.kind === "submit_evidence" && !evidenceLink && runId
      ? resolveVerdictNextAction({
          runId,
          workspaceId,
          recommendation: "GO",
        })
      : primary;

  const showSubmitPrimary =
    resolvedPrimary?.kind === "submit_evidence" && Boolean(evidenceLink);
  const showRevisePrimary =
    resolvedPrimary?.kind === "revise_pitch" || resolvedPrimary?.kind === "open_review";
  const showViewPrimary =
    resolvedPrimary?.kind === "view_evidence" && Boolean(evidenceLink);
  const reviseHref =
    runId && workspaceId ? revisePitchHref(workspaceId, runId) : null;
  const showReviseInMore =
    Boolean(completed && runId && reviseHref && resolvedPrimary?.kind === "submit_evidence");
  const showPrimaryCta =
    completed && resolvedPrimary && (showSubmitPrimary || showRevisePrimary || showViewPrimary);
  const hasDetail =
    problems.length > 0 || Boolean(blocker) || Boolean(experiment.title.trim());

  return (
    <div id="next-action" className={cn("mt-5 scroll-mt-6 space-y-3", className)}>
      {showPrimaryCta ? (
        <section
          className={cn(cardClass, "flex flex-wrap items-center justify-between gap-3 px-4 py-3")}
          aria-labelledby="next-action-heading"
        >
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <h3 id="next-action-heading" className="font-sans text-sm font-semibold text-ink">
                {showSubmitPrimary || showViewPrimary
                  ? RUN_PAGE_COPY.presentEvidence
                  : RUN_PAGE_COPY.revisePitch}
              </h3>
              <p className="mt-1 max-w-prose font-sans text-sm text-ink-muted">
                {showSubmitPrimary || showViewPrimary
                  ? RUN_PAGE_COPY.presentEvidenceLead
                  : "Update your pitch from this verdict, then start another review when ready."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {evidenceReplayPending ? (
              <span className="font-sans text-sm text-ink-muted" aria-live="polite">
                {RUN_PAGE_COPY.evidenceStatusLoading}
              </span>
            ) : showSubmitPrimary && onCompleteExperiment && evidenceLink?.useModal ? (
              <button type="button" onClick={onCompleteExperiment} className={heatCtaClass}>
                {resolvedPrimary.label}
              </button>
            ) : showSubmitPrimary && evidenceLink ? (
              <a href={evidenceLink.href} className={heatCtaClass}>
                {resolvedPrimary.label}
              </a>
            ) : showViewPrimary && evidenceLink ? (
              <a href={evidenceLink.href} className={heatCtaClass}>
                {evidenceLink.label}
              </a>
            ) : showRevisePrimary ? (
              <Link href={resolvedPrimary.href} className={heatCtaClass}>
                {resolvedPrimary.label}
              </Link>
            ) : null}

            {showReviseInMore && reviseHref ? (
              <MoreMenu label="More" align="right" iconOnly>
                <MoreMenuItem href={reviseHref}>{RUN_PAGE_COPY.revisePitch}</MoreMenuItem>
              </MoreMenu>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasDetail ? (
        <details className="group border-t border-rule-soft pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-sans text-sm font-semibold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <DisclosureChevron />
            Problems &amp; experiment
          </summary>
          <div className="mt-3 space-y-3">
            {problems.length > 0 && (
              <section className={cardClass} aria-labelledby="top-problems-heading">
                <header className="border-b border-rule-soft px-4 py-2.5">
                  <h3
                    id="top-problems-heading"
                    className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
                  >
                    {RUN_PAGE_COPY.topProblems}
                  </h3>
                </header>
                <ol className="list-none px-4 py-3" aria-label="Top three problems from this review">
                  {problems.map((problem, index) => (
                    <li
                      key={index}
                      className="flex min-h-7 gap-3 font-sans text-sm leading-relaxed text-ink"
                    >
                      <span
                        className="w-5 shrink-0 font-mono text-xs font-bold text-ink-muted"
                        aria-hidden
                      >
                        {index + 1}.
                      </span>
                      {problem}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {blocker && (
              <section
                className={cn(cardClass, "flex items-start gap-3 px-4 py-3")}
                aria-labelledby="blocker-heading"
              >
                <Target className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                <div>
                  <h3
                    id="blocker-heading"
                    className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
                  >
                    {RUN_PAGE_COPY.highestPriority}
                  </h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-ink">{blocker}</p>
                </div>
              </section>
            )}

            <ExperimentCard experiment={experiment} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
