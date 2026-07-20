"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ScoreDeltaBadge } from "@/features/appeal/score-delta-badge";
import { WorkspaceNextActionLink } from "@/features/history/workspace-history-row";
import { HISTORY_COPY, EMPTY_COPY } from "@/features/run/run-page-copy";
import { indexRunsByWorkspaceId } from "@/features/workspace/idea-run-index";
import { listRuns } from "@/lib/api/runs";
import { listWorkspaces, seedSampleWorkspace, workspacesQueryKey } from "@/lib/api/workspaces";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import type { StartupWorkspace } from "@/lib/lineage/workspace";
import { heatCtaClass } from "@/lib/cta-classes";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";

const LIFECYCLE_LABEL: Record<string, string> = {
  draft: "Draft",
  discovery: "Discovery",
  testing: "Testing",
  evidence_ready: "Evidence ready",
  judged: "Judged",
  iterating: "Iterating",
};

/** Shared with History so Ideas KPIs refetch when runs list is invalidated. */
const RUNS_LIST_QUERY_KEY = ["runs", "list"] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAvg(score: number): string {
  return `${score.toFixed(1)}/10`;
}

function IdeaRowKpis({ runMeta }: { runMeta: StartupWorkspace }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule-soft pt-3">
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-ink-muted">
        {runMeta.currentScore != null && (
          <div>
            <dt className="sr-only">{HISTORY_COPY.currentScore}</dt>
            <dd>
              {HISTORY_COPY.currentScore}{" "}
              <span className="font-mono font-semibold text-ink">
                {formatAvg(runMeta.currentScore)}
              </span>
            </dd>
          </div>
        )}
        {runMeta.latestDelta != null && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{HISTORY_COPY.latestDelta}</dt>
            <dd className="flex items-center gap-1.5">
              {HISTORY_COPY.latestDelta}
              {runMeta.latestDelta !== 0 ? (
                <ScoreDeltaBadge delta={runMeta.latestDelta} />
              ) : (
                <span className="text-xs">unchanged</span>
              )}
            </dd>
          </div>
        )}
      </dl>
      <WorkspaceNextActionLink workspace={runMeta} className="min-w-0" />
    </div>
  );
}

export function WorkspaceList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: workspacesQueryKey(),
    queryFn: () => listWorkspaces({ limit: 50 }),
  });

  // ponytail: join runs client-side for score/delta; fail soft so Ideas still lists
  const runsQuery = useQuery({
    queryKey: RUNS_LIST_QUERY_KEY,
    queryFn: () => listRuns({ limit: 100 }),
    retry: 1,
    refetchOnMount: "always",
  });

  const runByWorkspace = indexRunsByWorkspaceId(runsQuery.data?.runs ?? []);

  const seedMutation = useMutation({
    mutationFn: seedSampleWorkspace,
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey() });
      toast.success("Example idea loaded");
      router.push(`/workspaces/${res.workspace.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? parseApiDetail(err.body) : "Could not load example");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="font-sans text-body text-fail" role="alert">
        Could not load ideas. Is the API running?
      </p>
    );
  }

  const workspaces = data?.workspaces ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
            Gavel
          </p>
          <h1 className="mt-2 font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
            Your ideas on trial
          </h1>
          <p className="mt-2 max-w-prose font-sans text-body text-ink-muted">
            Each idea is one case in Gavel — pitch, evidence, and reviews.
          </p>
        </div>
        <Link href="/workspaces/new" className={cn(heatCtaClass, "inline-flex gap-2")}>
          <Plus className="size-4" aria-hidden />
          New idea
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          title={EMPTY_COPY.ideasTitle}
          description={EMPTY_COPY.ideasDescription}
          action={
            <>
              <Button asChild>
                <Link href="/workspaces/new">{EMPTY_COPY.ideasCta}</Link>
              </Button>
              <button
                type="button"
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate()}
                className="inline-flex min-h-11 items-center gap-2 font-sans text-sm font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta disabled:opacity-50"
              >
                {seedMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4 text-ai-processing" aria-hidden />
                )}
                Load example
              </button>
            </>
          }
        />
      ) : (
        <ul className="space-y-3" aria-label="Ideas">
          {workspaces.map((ws) => {
            const runMeta = runByWorkspace.get(ws.id);
            return (
              <li key={ws.id}>
                <Card className="p-4 transition-colors hover:border-cta/30 hover:bg-paper-2">
                  <Link
                    href={`/workspaces/${ws.id}`}
                    className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-sans text-lg font-semibold text-ink">
                          {ws.working_name}
                        </h2>
                        <p className="mt-1 font-sans text-meta text-ink-muted">
                          Updated {formatDate(ws.updated_at)}
                          {ws.assumption_count > 0 &&
                            ` · ${ws.assumption_count} assumption${ws.assumption_count === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <Badge variant="default">
                        {LIFECYCLE_LABEL[ws.lifecycle] ?? ws.lifecycle}
                      </Badge>
                    </div>
                  </Link>
                  {runMeta ? <IdeaRowKpis runMeta={runMeta} /> : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
