"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import {
  exportJudgeBrief,
  exportWorkspaceMarkdown,
  suggestInterviewQuestions,
  validationCoach,
  validationOverviewQueryKey,
  weeklyReview,
} from "@/lib/api/workspaces";

export function useWorkspaceOverviewMutations(
  workspaceId: string,
  workingName: string,
) {
  const queryClient = useQueryClient();

  const questionsMutation = useMutation({
    mutationFn: () => suggestInterviewQuestions(workspaceId),
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not load questions");
    },
  });

  const coachMutation = useMutation({
    mutationFn: () => validationCoach(workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: validationOverviewQueryKey(workspaceId) });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Coach unavailable");
    },
  });

  const weeklyMutation = useMutation({
    mutationFn: () => weeklyReview(workspaceId),
    onSuccess: () => toast.success("Weekly review ready"),
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Weekly review unavailable");
    },
  });

  const exportMarkdownMutation = useMutation({
    mutationFn: () => exportWorkspaceMarkdown(workspaceId, workingName),
    onSuccess: () => toast.success("Markdown export downloaded"),
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Export failed");
    },
  });

  const exportBriefMutation = useMutation({
    mutationFn: () => exportJudgeBrief(workspaceId, workingName),
    onSuccess: () => toast.success("Judge brief downloaded"),
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Export failed");
    },
  });

  return {
    questionsMutation,
    coachMutation,
    weeklyMutation,
    exportMarkdownMutation,
    exportBriefMutation,
  };
}
