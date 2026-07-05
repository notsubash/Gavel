"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/ui/button";
import type { CompetitorScanResponse } from "@/lib/api/workspaces";
import type { ValidationMutations } from "./use-validation-mutations";

export function ValidationActionBar({
  mutations,
  onLogInterview,
  onAddEvidence,
  onQuestionsReady,
  onExperimentDraftReady,
  onCompetitorScanSuccess,
}: {
  mutations: ValidationMutations;
  onLogInterview: () => void;
  onAddEvidence: () => void;
  onQuestionsReady: (questions: { question: string; rationale: string }[]) => void;
  onExperimentDraftReady: (draft: Partial<import("@/lib/api/workspaces").Experiment>) => void;
  onCompetitorScanSuccess: (result: CompetitorScanResponse) => void;
}) {
  const {
    questionsMutation,
    suggestExperimentMutation,
    competitorScanMutation,
  } = mutations;

  return (
    <section aria-labelledby="actions-heading" className="flex flex-wrap gap-3">
      <h2 id="actions-heading" className="sr-only">
        Validation actions
      </h2>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          questionsMutation.mutate(undefined, {
            onSuccess: (res) => onQuestionsReady(res.questions),
          })
        }
        disabled={questionsMutation.isPending}
      >
        {questionsMutation.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden />
        )}
        Suggest interview questions
      </Button>
      <Button type="button" variant="outline" onClick={onLogInterview}>
        Log interview
      </Button>
      <Button type="button" variant="outline" onClick={onAddEvidence}>
        Add evidence
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          suggestExperimentMutation.mutate(undefined, {
            onSuccess: (res) => onExperimentDraftReady(res.experiment),
          })
        }
        disabled={suggestExperimentMutation.isPending}
      >
        {suggestExperimentMutation.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden />
        )}
        Suggest experiment
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          competitorScanMutation.mutate(undefined, {
            onSuccess: (res) => onCompetitorScanSuccess(res),
          })
        }
        disabled={competitorScanMutation.isPending}
      >
        {competitorScanMutation.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden />
        )}
        Scan competitors
      </Button>
    </section>
  );
}
