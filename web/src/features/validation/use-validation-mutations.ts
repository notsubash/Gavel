"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import {
  createEvidence,
  createExperiment,
  createInterview,
  competitorScan,
  type CompetitorIntelItem,
  mapEvidence,
  suggestExperiment,
  suggestInterviewQuestions,
  summarizeInterview,
  updateAssumption,
  updateExperiment,
  validationDataQueryKey,
  validationOverviewQueryKey,
  workspaceQueryKey,
  type AssumptionStatus,
  type Experiment,
} from "@/lib/api/workspaces";

export function useValidationMutations(workspaceId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: validationDataQueryKey(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: validationOverviewQueryKey(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
  };

  const mutationError = (fallback: string) => (err: unknown) => {
    toast.error(err instanceof ApiError ? parseApiDetail(err.body) : fallback);
  };

  const questionsMutation = useMutation({
    mutationFn: () => suggestInterviewQuestions(workspaceId),
    onError: mutationError("Could not suggest questions"),
  });

  const summarizeMutation = useMutation({
    mutationFn: (input: { notes: string; person_label?: string }) =>
      summarizeInterview(workspaceId, input),
    onError: mutationError("Summarize failed"),
  });

  const saveInterviewMutation = useMutation({
    mutationFn: (input: Parameters<typeof createInterview>[1]) =>
      createInterview(workspaceId, input),
    onSuccess: () => {
      toast.success("Interview saved");
      invalidate();
    },
    onError: mutationError("Could not save interview"),
  });

  const mapEvidenceMutation = useMutation({
    mutationFn: (input: { content: string; type: string }) =>
      mapEvidence(workspaceId, input),
    onError: mutationError("Could not suggest assumption links"),
  });

  const saveEvidenceMutation = useMutation({
    mutationFn: (input: Parameters<typeof createEvidence>[1]) =>
      createEvidence(workspaceId, input),
    onSuccess: () => {
      toast.success("Evidence logged");
      invalidate();
    },
    onError: mutationError("Could not save evidence"),
  });

  const suggestExperimentMutation = useMutation({
    mutationFn: () => suggestExperiment(workspaceId),
    onError: mutationError("Suggest failed"),
  });

  const competitorScanMutation = useMutation({
    mutationFn: () => competitorScan(workspaceId),
    onError: mutationError("Scan failed"),
  });

  const saveExperimentMutation = useMutation({
    mutationFn: (draft: Partial<Experiment>) => {
      if (!draft.title || !draft.hypothesis) {
        throw new Error("Title and hypothesis required");
      }
      return createExperiment(workspaceId, {
        title: draft.title,
        hypothesis: draft.hypothesis,
        assumption_id: draft.assumption_id ?? null,
        method: draft.method ?? null,
        target: draft.target ?? null,
        pass_fail_threshold: draft.pass_fail_threshold ?? null,
        start_date: draft.start_date ?? null,
        due_date: draft.due_date ?? null,
        status: draft.status ?? "planned",
      });
    },
    onSuccess: () => {
      toast.success("Experiment created");
      invalidate();
    },
    onError: mutationError("Could not create experiment"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AssumptionStatus }) =>
      updateAssumption(workspaceId, id, { status }),
    onSuccess: invalidate,
    onError: mutationError("Could not update assumption status"),
  });

  const experimentStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      result,
      decision,
    }: {
      id: string;
      status: Experiment["status"];
      result?: string;
      decision?: string;
    }) => updateExperiment(workspaceId, id, { status, result, decision }),
    onSuccess: invalidate,
    onError: mutationError("Could not update experiment"),
  });

  return {
    invalidate,
    questionsMutation,
    summarizeMutation,
    saveInterviewMutation,
    mapEvidenceMutation,
    saveEvidenceMutation,
    suggestExperimentMutation,
    competitorScanMutation,
    saveExperimentMutation,
    statusMutation,
    experimentStatusMutation,
  };
}

export type ValidationMutations = ReturnType<typeof useValidationMutations>;

export type CompetitorScanState = {
  result: string | null;
  intel: CompetitorIntelItem[];
  findings: Array<{ title: string; url: string; snippet: string }>;
};
