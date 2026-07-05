"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { EditorialContainer } from "@/components/app-shell";
import { ApiError } from "@/lib/api/client";
import { listRuns } from "@/lib/api/runs";
import { heatCtaClass } from "@/lib/cta-classes";
import { groupByLineage } from "@/lib/lineage/lineage";
import { deriveStartupWorkspace } from "@/lib/lineage/workspace";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

import { HISTORY_COPY, RUN_PAGE_COPY } from "@/features/run/run-page-copy";

import { WorkspaceHistoryRow } from "./workspace-history-row";

function HistorySkeleton() {
  return (
    <div className="border border-rule-soft">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-b border-rule-soft px-4 py-4 last:border-b-0">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function RunHistoryList() {
  const query = useQuery({
    queryKey: ["runs", "list"],
    queryFn: () => listRuns(),
    retry: 1,
  });

  return (
    <EditorialContainer className="py-4 md:py-6">
      <header>
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          {HISTORY_COPY.eyebrow}
        </p>
        <h1 className="mt-2 font-sans text-section font-semibold text-ink">
          {HISTORY_COPY.title}
        </h1>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          {HISTORY_COPY.description}
        </p>
      </header>

      <div className="mt-6">
        {query.isLoading && <HistorySkeleton />}

        {query.isError && (
          <div className="surface-flat space-y-3 p-6" role="alert">
            <p className="font-sans text-body font-semibold text-ink">Could not load workspaces</p>
            <p className="font-sans text-meta text-ink-muted">
              {query.error instanceof ApiError
                ? "The API returned an error. Try refreshing."
                : "Check your connection and try again."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {query.isSuccess && query.data.runs.length === 0 && (
          <div className="border border-dashed border-rule-soft bg-paper-2 p-8 text-center md:p-10">
            <p className="font-sans text-section font-semibold text-ink">{HISTORY_COPY.emptyTitle}</p>
            <p className="mt-2 font-sans text-meta text-ink-muted">
              {HISTORY_COPY.emptyDescription}
            </p>
            <Link href="/workspaces/new" className={`mt-6 inline-flex ${heatCtaClass}`}>
              {RUN_PAGE_COPY.submitIdea}
            </Link>
          </div>
        )}

        {query.isSuccess && query.data.runs.length > 0 && (
          <ul className="border border-rule-soft">
            {groupByLineage(query.data.runs).map((lineage) => (
              <WorkspaceHistoryRow
                key={lineage[0]!.run_id}
                workspace={deriveStartupWorkspace(lineage)}
              />
            ))}
          </ul>
        )}
      </div>
    </EditorialContainer>
  );
}
