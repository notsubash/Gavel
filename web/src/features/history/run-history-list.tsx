"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { EditorialContainer } from "@/components/app-shell";
import { ApiError } from "@/lib/api/client";
import { listRuns } from "@/lib/api/runs";
import { isUiShellV2Enabled, isWorkspaceHistoryEnabled } from "@/lib/feature-flags";
import { heatCtaClass } from "@/lib/cta-classes";
import { groupByLineage } from "@/lib/lineage/lineage";
import { deriveStartupWorkspace } from "@/lib/lineage/workspace";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";

import { HISTORY_COPY, HISTORY_COPY_LEGACY, RUN_PAGE_COPY } from "@/features/run/run-page-copy";

import { LineageHistoryGroup } from "./lineage-history-group";
import { WorkspaceHistoryRow } from "./workspace-history-row";

function HistorySkeleton({ rowBased }: { rowBased: boolean }) {
  if (rowBased) {
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

  return (
    <ul className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="border border-rule-soft bg-card p-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </li>
      ))}
    </ul>
  );
}

export function RunHistoryList() {
  const workspaceHistory = isWorkspaceHistoryEnabled();
  const shellV2 = isUiShellV2Enabled();
  const copy = workspaceHistory ? HISTORY_COPY : HISTORY_COPY_LEGACY;
  const query = useQuery({
    queryKey: ["runs", "list"],
    queryFn: () => listRuns(),
    retry: 1,
  });

  return (
    <EditorialContainer className={shellV2 ? "py-4 md:py-6" : "py-12 md:py-16 lg:py-24"}>
      <header>
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          {copy.eyebrow}
        </p>
        <h1
          className={cn(
            "mt-2 font-sans font-semibold text-ink",
            shellV2 ? "text-section" : "text-title md:text-display-md",
          )}
        >
          {copy.title}
        </h1>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          {copy.description}
        </p>
      </header>

      <div className={shellV2 ? "mt-6" : "mt-10"}>
        {query.isLoading && <HistorySkeleton rowBased={workspaceHistory} />}

        {query.isError && (
          <div className="surface-flat p-6" role="alert">
            <p className="font-sans text-body font-semibold text-ink">Could not load workspaces</p>
            <p className="mt-2 font-sans text-meta text-ink-muted">
              {query.error instanceof ApiError
                ? "The API returned an error. Try refreshing."
                : "Check your connection and try again."}
            </p>
          </div>
        )}

        {query.isSuccess && query.data.runs.length === 0 && (
          <div className="border border-dashed border-rule-soft bg-paper-2 p-8 text-center md:p-10">
            <p className="font-sans text-section font-semibold text-ink">{copy.emptyTitle}</p>
            <p className="mt-2 font-sans text-meta text-ink-muted">
              {copy.emptyDescription}
            </p>
            <Link href="/" className={cn("mt-6 inline-flex", heatCtaClass)}>
              {RUN_PAGE_COPY.submitIdea}
            </Link>
          </div>
        )}

        {query.isSuccess && query.data.runs.length > 0 && workspaceHistory && (
          <ul className="border border-rule-soft">
            {groupByLineage(query.data.runs).map((lineage) => (
              <WorkspaceHistoryRow
                key={lineage[0]!.run_id}
                workspace={deriveStartupWorkspace(lineage)}
              />
            ))}
          </ul>
        )}

        {query.isSuccess && query.data.runs.length > 0 && !workspaceHistory && (
          <ul className="space-y-4">
            {groupByLineage(query.data.runs).map((lineage) => (
              <LineageHistoryGroup key={lineage[0]!.run_id} lineage={lineage} />
            ))}
          </ul>
        )}
      </div>
    </EditorialContainer>
  );
}
