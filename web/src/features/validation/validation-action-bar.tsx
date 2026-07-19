"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";

import { deriveValidationWorkbenchAction } from "@/features/workspace/derive-primary-action";
import type { CompetitorScanResponse, Experiment, ValidationOverview } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";

import type { ValidationMutations } from "./use-validation-mutations";

type ValidationActionBarProps = {
  overview: ValidationOverview | null | undefined;
  mutations: ValidationMutations;
  onLogInterview: () => void;
  onAddEvidence: () => void;
  onQuestionsReady: (questions: { question: string; rationale: string }[]) => void;
  onExperimentDraftReady: (draft: Partial<Experiment>) => void;
  onCompetitorScanSuccess: (result: CompetitorScanResponse) => void;
};

export function ValidationActionBar({
  overview,
  mutations,
  onLogInterview,
  onAddEvidence,
  onQuestionsReady,
  onExperimentDraftReady,
  onCompetitorScanSuccess,
}: ValidationActionBarProps) {
  const { questionsMutation, suggestExperimentMutation, competitorScanMutation } = mutations;
  const primary = deriveValidationWorkbenchAction(overview);

  const runSuggestQuestions = () =>
    questionsMutation.mutate(undefined, {
      onSuccess: (res) => onQuestionsReady(res.questions),
    });

  const runSuggestExperiment = () =>
    suggestExperimentMutation.mutate(undefined, {
      onSuccess: (res) => onExperimentDraftReady(res.experiment),
    });

  const runCompetitorScan = () =>
    competitorScanMutation.mutate(undefined, {
      onSuccess: (res) => onCompetitorScanSuccess(res),
    });

  const primaryPending =
    (primary.kind === "start_experiment" && suggestExperimentMutation.isPending) ||
    (primary.kind === "scan_competitors" && competitorScanMutation.isPending);

  const onPrimary = () => {
    if (primary.kind === "log_interview") onLogInterview();
    else if (primary.kind === "add_evidence") onAddEvidence();
    else if (primary.kind === "start_experiment") runSuggestExperiment();
    else runCompetitorScan();
  };

  return (
    <section aria-labelledby="actions-heading" className="flex flex-wrap items-center gap-3">
      <h2 id="actions-heading" className="sr-only">
        Validation actions
      </h2>
      <Button type="button" onClick={onPrimary} disabled={primaryPending} aria-busy={primaryPending || undefined}>
        {primaryPending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
        {primary.label}
      </Button>

      <details className="relative">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-ui border border-rule-soft bg-card px-4",
            "font-sans text-sm font-semibold text-ink transition-colors duration-200",
            "hover:bg-paper-2 active:bg-paper",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
            "[&::-webkit-details-marker]:hidden",
          )}
        >
          Add…
          <ChevronDown className="size-4 text-ink-muted" aria-hidden />
        </summary>
        <div
          className="absolute left-0 z-10 mt-1 min-w-56 rounded-ui border border-rule-soft bg-card py-1 shadow-soft"
          role="group"
          aria-label="Add validation items"
        >
          <MenuItem
            label="Suggest interview questions"
            icon
            pending={questionsMutation.isPending}
            onClick={runSuggestQuestions}
          />
          {primary.kind !== "log_interview" ? (
            <MenuItem label="Log interview" onClick={onLogInterview} />
          ) : null}
          {primary.kind !== "add_evidence" ? (
            <MenuItem label="Add evidence" onClick={onAddEvidence} />
          ) : null}
          {primary.kind !== "start_experiment" ? (
            <MenuItem
              label="Suggest experiment"
              icon
              pending={suggestExperimentMutation.isPending}
              onClick={runSuggestExperiment}
            />
          ) : null}
          {primary.kind !== "scan_competitors" ? (
            <MenuItem
              label="Scan competitors"
              icon
              pending={competitorScanMutation.isPending}
              onClick={runCompetitorScan}
              hint="Logs research as evidence; Pitch keeps the short summary"
            />
          ) : null}
        </div>
      </details>
    </section>
  );
}

function MenuItem({
  label,
  icon,
  pending,
  onClick,
  hint,
}: {
  label: string;
  icon?: boolean;
  pending?: boolean;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending || undefined}
      title={hint}
      className={cn(
        "flex w-full min-h-11 flex-col items-start gap-0.5 px-4 py-2 text-left font-sans text-sm text-ink",
        "hover:bg-paper-2 active:bg-paper disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta",
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : icon ? (
          <Sparkles className="size-4 text-ai-processing" aria-hidden />
        ) : null}
        {label}
      </span>
      {hint ? <span className="pl-6 text-xs text-ink-muted">{hint}</span> : null}
    </button>
  );
}
