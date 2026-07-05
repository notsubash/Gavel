"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { WorkspaceNav } from "@/features/workspace/workspace-nav";
import {
  CONFIDENCE_DISPLAY,
  getValidationOverview,
  getWorkspace,
  suggestInterviewQuestions,
  validationCoach,
  validationOverviewQueryKey,
  workspaceQueryKey,
} from "@/lib/api/workspaces";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

const LIFECYCLE_LABEL: Record<string, string> = {
  draft: "Draft",
  discovery: "Discovery",
  testing: "Testing",
  evidence_ready: "Evidence ready",
  judged: "Judged",
  iterating: "Iterating",
};

const READINESS_LABEL: Record<string, string> = {
  too_vague: "Too vague",
  speculative: "Speculative",
  ready: "Ready for judges",
};

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [planInterviewOpen, setPlanInterviewOpen] = useState(false);
  const [interviewQuestions, setInterviewQuestions] = useState<
    { question: string; rationale: string }[]
  >([]);
  const [coachNarrative, setCoachNarrative] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
  });

  const overviewQuery = useQuery({
    queryKey: validationOverviewQueryKey(workspaceId),
    queryFn: () => getValidationOverview(workspaceId),
  });

  useEffect(() => {
    if (searchParams.get("plan_interview") === "1") {
      setPlanInterviewOpen(true);
    }
  }, [searchParams]);

  const questionsMutation = useMutation({
    mutationFn: () => suggestInterviewQuestions(workspaceId),
    onSuccess: (res) => {
      setInterviewQuestions(res.questions);
      toast.success("Interview questions ready");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not load questions");
    },
  });

  const coachMutation = useMutation({
    mutationFn: () => validationCoach(workspaceId),
    onSuccess: (res) => {
      setCoachNarrative(res.narrative);
      void queryClient.invalidateQueries({ queryKey: validationOverviewQueryKey(workspaceId) });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Coach unavailable");
    },
  });

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

        {overviewQuery.isLoading && (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
        )}
        {overviewQuery.isError && (
          <p className="font-sans text-sm text-ink-muted" role="status">
            Validation status unavailable.
          </p>
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

        <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          {ws.working_name}
        </h1>
        <WorkspaceNav workspaceId={workspaceId} />
        <p className="max-w-prose font-sans text-body text-ink-muted">{ws.audience}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/workspaces/${workspaceId}/validation`}>Validation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/workspaces/${workspaceId}/worksheet`}>Edit worksheet</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/workspaces/${workspaceId}/judges`}>Judges</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => coachMutation.mutate()}
            disabled={coachMutation.isPending}
          >
            {coachMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-2 size-4" aria-hidden />
            )}
            Coach
          </Button>
        </div>
      </header>

      {overview && (
        <section aria-labelledby="next-step-heading">
          <h2 id="next-step-heading" className="font-sans text-section font-semibold text-ink">
            Next validation step
          </h2>
          <Card className="mt-3 p-5">
            <p className="font-sans text-body text-ink">{overview.checklist.next_action}</p>
            {coachNarrative && (
              <p className="mt-3 border-t border-rule-soft pt-3 font-sans text-sm text-ink-muted">
                <Badge variant="heat" className="mb-2">
                  AI coach
                </Badge>
                <span className="block">{coachNarrative}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {overview.checklist.items.map((item) => (
                <Badge
                  key={item.stage}
                  variant={item.completed ? "pass" : "default"}
                  title={item.label}
                >
                  {item.completed ? "✓" : "○"} {item.stage.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </Card>
        </section>
      )}

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
        <Card className="space-y-4 border-cta/30 p-5">
          <h2 className="font-sans text-section font-semibold text-ink">Plan first interview</h2>
          <p className="font-sans text-body text-ink-muted">
            Customer discovery starts here. Use Mom Test questions about past behavior, not
            hypotheticals.
          </p>
          {interviewQuestions.length === 0 ? (
            <Button
              type="button"
              onClick={() => questionsMutation.mutate()}
              disabled={questionsMutation.isPending}
            >
              {questionsMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="mr-2 size-4" aria-hidden />
              )}
              Suggest interview questions
            </Button>
          ) : (
            <ul className="space-y-2 font-sans text-sm text-ink">
              {interviewQuestions.map((q) => (
                <li key={q.question} className="rounded-ui border border-rule-soft p-3">
                  <span className="font-medium">{q.question}</span>
                  <span className="mt-1 block text-ink-muted">{q.rationale}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/workspaces/${workspaceId}/validation`}>Go to validation</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPlanInterviewOpen(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
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
