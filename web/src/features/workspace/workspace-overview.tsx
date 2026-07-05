"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { InterviewPlanPanel } from "@/features/workspace/interview-plan-panel";
import { NextStepHero } from "@/features/workspace/next-step-hero";
import { ValidationProgressSection } from "@/features/workspace/validation-progress-section";
import { WeeklyReviewSection } from "@/features/workspace/weekly-review-section";
import { WorkspaceActionBar } from "@/features/workspace/workspace-action-bar";
import { WorkspaceNav } from "@/features/workspace/workspace-nav";
import {
  CONFIDENCE_DISPLAY,
  getValidationOverview,
  getWorkspace,
  validationOverviewQueryKey,
  workspaceQueryKey,
} from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import {
  LIFECYCLE_LABEL,
  READINESS_LABEL,
} from "@/features/workspace/workspace-overview-labels";
import { useWorkspaceOverviewMutations } from "@/features/workspace/use-workspace-overview-mutations";

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const interviewOpenToken =
    searchParams.get("plan_interview") === "1" ? searchParams.toString() : null;
  const [dismissedInterviewToken, setDismissedInterviewToken] = useState<string | null>(null);
  const planInterviewOpen =
    interviewOpenToken !== null && dismissedInterviewToken !== interviewOpenToken;
  const [interviewQuestions, setInterviewQuestions] = useState<
    { question: string; rationale: string }[]
  >([]);
  const [coachNarrative, setCoachNarrative] = useState<string | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<{
    summary: string;
    highlights: string[];
    open_questions: string[];
    evidence_count: number;
  } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
  });

  const overviewQuery = useQuery({
    queryKey: validationOverviewQueryKey(workspaceId),
    queryFn: () => getValidationOverview(workspaceId),
  });

  const workingName = data?.current_version.worksheet.working_name ?? "workspace";

  const mutations = useWorkspaceOverviewMutations(workspaceId, workingName);

  // ponytail: wrap mutations to keep local UI state in overview orchestrator
  const questionsMutation = {
    ...mutations.questionsMutation,
    mutate: () =>
      mutations.questionsMutation.mutate(undefined, {
        onSuccess: (res) => {
          setInterviewQuestions(res.questions);
          toast.success("Interview questions ready");
        },
      }),
  };

  const coachMutation = {
    ...mutations.coachMutation,
    mutate: () =>
      mutations.coachMutation.mutate(undefined, {
        onSuccess: (res) => {
          setCoachNarrative(res.narrative);
        },
      }),
  };

  const weeklyMutation = {
    ...mutations.weeklyMutation,
    mutate: () =>
      mutations.weeklyMutation.mutate(undefined, {
        onSuccess: (res) => setWeeklyDigest(res),
      }),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="font-sans text-body text-fail" role="alert">
        Workspace not found or API unavailable.
      </p>
    );
  }

  const { workspace, current_version, assumptions } = data;
  const ws = current_version.worksheet;
  const overview = overviewQuery.data;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">
            {LIFECYCLE_LABEL[workspace.lifecycle] ?? workspace.lifecycle}
          </Badge>
          <span className="font-sans text-meta text-ink-muted">
            Version {current_version.version}
          </span>
          {overview && (
            <Badge
              variant={
                overview.readiness.level === "ready"
                  ? "pass"
                  : overview.readiness.level === "speculative"
                    ? "conditional"
                    : "fail"
              }
            >
              {READINESS_LABEL[overview.readiness.level] ?? overview.readiness.level}
            </Badge>
          )}
        </div>

        <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          {ws.working_name}
        </h1>

        <NextStepHero
          workspaceId={workspaceId}
          lifecycle={workspace.lifecycle}
          overview={overview}
          overviewLoading={overviewQuery.isLoading}
          overviewError={overviewQuery.isError}
          coachNarrative={coachNarrative}
          onRetryOverview={() => void overviewQuery.refetch()}
        />

        <WorkspaceNav workspaceId={workspaceId} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose font-sans text-body text-ink-muted">{ws.audience}</p>
          <WorkspaceActionBar
            coachMutation={coachMutation}
            exportMarkdownMutation={mutations.exportMarkdownMutation}
            exportBriefMutation={mutations.exportBriefMutation}
          />
        </div>

        {overviewQuery.isLoading && (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
        )}
        {overview && (
          <div className="flex flex-wrap gap-2">
            {overview.confidence.chips.map((chip) => (
              <Badge key={chip.dimension} variant="default" title={chip.drivers.join("; ")}>
                {chip.dimension}: {CONFIDENCE_DISPLAY[chip.label] ?? chip.label}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {overview && (
        <ValidationProgressSection workspaceId={workspaceId} items={overview.checklist.items} />
      )}

      <WeeklyReviewSection digest={weeklyDigest} weeklyMutation={weeklyMutation} />

      {overview?.active_experiment && (
        <section aria-labelledby="active-experiment-heading">
          <h2
            id="active-experiment-heading"
            className="font-sans text-section font-semibold text-ink"
          >
            Active experiment
          </h2>
          <Card className="mt-3 p-5">
            <p className="font-sans text-body font-medium text-ink">
              {overview.active_experiment.title}
            </p>
            <p className="mt-1 font-sans text-sm text-ink-muted">
              {overview.active_experiment.hypothesis}
            </p>
          </Card>
        </section>
      )}

      {(overview?.top_assumptions.length ?? assumptions.length) > 0 && (
        <section aria-labelledby="top-assumptions-heading">
          <h2
            id="top-assumptions-heading"
            className="font-sans text-section font-semibold text-ink"
          >
            Top risky assumptions
          </h2>
          <ul className="mt-3 space-y-2">
            {(overview?.top_assumptions ?? assumptions.slice(0, 3)).map((a) => (
              <li key={a.id}>
                <Card className="p-4">
                  <p className="font-sans text-body text-ink">{a.statement}</p>
                  <p className="mt-1 font-sans text-meta text-ink-muted">
                    {a.type} · {a.status}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {planInterviewOpen && (
        <InterviewPlanPanel
          workspaceId={workspaceId}
          questions={interviewQuestions}
          questionsMutation={questionsMutation}
          onDismiss={() => setDismissedInterviewToken(interviewOpenToken)}
        />
      )}

      <section aria-labelledby="worksheet-summary-heading">
        <h2
          id="worksheet-summary-heading"
          className="font-sans text-section font-semibold text-ink"
        >
          Worksheet summary
        </h2>
        <Card className="mt-3 p-5">
          <dl className="space-y-4 font-sans text-body">
            <div>
              <dt className="text-meta font-semibold uppercase tracking-wide text-ink-subtle">
                Problem
              </dt>
              <dd className="mt-1 text-ink">{ws.problem_statement}</dd>
            </div>
            <div>
              <dt className="text-meta font-semibold uppercase tracking-wide text-ink-subtle">
                Solution
              </dt>
              <dd className="mt-1 text-ink">{ws.solution_statement}</dd>
            </div>
          </dl>
        </Card>
      </section>
    </div>
  );
}
