"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

import { getRunPanel, runPanelQueryKey } from "@/lib/api/runs";
import type { RunListItem } from "@/lib/api/types-helpers";
import { useInView } from "@/lib/hooks/use-in-view";
import { sidebarLineageVersions } from "@/lib/lineage/lineage";
import type { StartupWorkspace } from "@/lib/lineage/workspace";
import {
  deriveNextActionFromPanel,
  deriveNextActionFromStatus,
} from "./workspace-next-action";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";

import { ScoreDeltaBadge } from "../appeal/score-delta-badge";
import { HISTORY_COPY } from "../run/run-page-copy";

import { HistoryConfidencePreview } from "./history-confidence-preview";

function formatAvg(score: number): string {
  return `${score.toFixed(1)}/10`;
}

function VersionRow({ item, active }: { item: RunListItem; active: boolean }) {
  const avg = item.verdict_summary?.avg_score;
  return (
    <Link
      href={`/run/${item.run_id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between gap-3 py-2 pl-4 font-sans text-sm text-ink-muted",
        "border-l-2 border-rule-soft hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
        active && "border-l-cta bg-paper-2 text-ink",
      )}
    >
      <span className="font-mono">
        v{item.version}
        {avg != null && item.status === "completed" ? ` · ${formatAvg(avg)}` : ""}
      </span>
      <span className="font-mono text-xs text-ink-subtle">
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          new Date(item.created_at),
        )}
      </span>
    </Link>
  );
}

function WorkspaceNextActionLink({
  workspace,
  className,
}: {
  workspace: StartupWorkspace;
  className?: string;
}) {
  const [ref, inView] = useInView();
  const shouldFetch = inView && workspace.latestStatus === "completed";

  const panelQuery = useQuery({
    queryKey: runPanelQueryKey(workspace.latestRunId),
    queryFn: () => getRunPanel(workspace.latestRunId),
    enabled: shouldFetch,
    retry: 1,
    staleTime: 60_000,
  });

  const statusAction = deriveNextActionFromStatus({
    run_id: workspace.latestRunId,
    status: workspace.latestStatus,
  });

  const panelPending = shouldFetch && panelQuery.isLoading && !panelQuery.data;
  const action =
    panelQuery.data != null
      ? deriveNextActionFromPanel(
          workspace.latestRunId,
          workspace.latestStatus,
          panelQuery.data.verdicts,
        )
      : statusAction;

  return (
    <div
      ref={ref}
      className={className}
      aria-busy={panelPending || undefined}
      aria-live={panelPending ? "polite" : undefined}
    >
      {panelPending ? (
        <Skeleton className="h-9 w-44" aria-label="Loading next action" />
      ) : (
        <Link
          href={action.href}
          title={action.detail ?? action.label}
          aria-label={
            action.detail ? `${action.label}: ${action.detail}` : action.label
          }
          className={cn(
            "flex min-h-9 min-w-0 items-center gap-1.5 font-sans text-sm font-semibold text-cta sm:justify-end",
            "hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
          )}
        >
          <span className="truncate">{action.label}</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function WorkspaceHistoryRow({ workspace }: { workspace: StartupWorkspace }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const olderVersionsId = `older-versions-${workspace.workspaceId}`;
  const { lineage, latestRunId, latestStatus } = workspace;
  const { visible, hidden } = sidebarLineageVersions(lineage);
  const activeRunId = pathname.startsWith("/run/") ? pathname.slice("/run/".length) : null;
  const isActiveWorkspace =
    activeRunId != null && lineage.some((run) => run.run_id === activeRunId);
  const showConfidence = latestStatus === "completed";

  return (
    <li
      className={cn(
        "surface-row last:border-b-0",
        isActiveWorkspace && "bg-paper-2/60 shadow-[inset_3px_0_0_0_var(--cta)]",
      )}
      data-active={isActiveWorkspace || undefined}
    >
      <div
        className={cn(
          "group grid gap-3 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start sm:gap-6 sm:py-4",
          "hover:bg-paper-2",
        )}
      >
        <div className="min-w-0">
          <Link
            href={`/run/${latestRunId}`}
            aria-current={activeRunId === latestRunId ? "page" : undefined}
            className={cn(
              "block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta",
            )}
          >
            <p className="truncate font-sans text-body font-semibold text-ink group-hover:text-cta">
              {workspace.displayName}
            </p>
          </Link>

          <dl className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-ink-muted">
            <div>
              <dt className="sr-only">Version count</dt>
              <dd>{HISTORY_COPY.versionCount(workspace.versionCount)}</dd>
            </div>
            {workspace.currentScore != null && (
              <div>
                <dt className="sr-only">{HISTORY_COPY.currentScore}</dt>
                <dd>
                  {HISTORY_COPY.currentScore}{" "}
                  <span className="font-mono font-semibold text-ink">
                    {formatAvg(workspace.currentScore)}
                  </span>
                </dd>
              </div>
            )}
            {workspace.latestDelta != null && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">{HISTORY_COPY.latestDelta}</dt>
                <dd className="flex items-center gap-1.5">
                  {HISTORY_COPY.latestDelta}
                  {workspace.latestDelta !== 0 ? (
                    <ScoreDeltaBadge delta={workspace.latestDelta} />
                  ) : (
                    <span className="text-xs">unchanged</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="min-w-0 sm:text-right">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-subtle">
            {HISTORY_COPY.openNextAction}
          </p>
          <WorkspaceNextActionLink workspace={workspace} className="mt-1 min-w-0" />
        </div>
      </div>

      {showConfidence && (
        <div className="border-t border-rule-soft px-4 pb-3">
          <HistoryConfidencePreview runId={latestRunId} className="mt-2" />
        </div>
      )}

      {lineage.length > 1 && (
        <div className="border-t border-rule-soft px-4 py-2">
          {hidden.length > 0 && (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 font-sans text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
              aria-expanded={expanded}
              aria-controls={olderVersionsId}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? (
                <ChevronUp className="size-3.5" aria-hidden />
              ) : (
                <ChevronDown className="size-3.5" aria-hidden />
              )}
              {HISTORY_COPY.olderVersions(hidden.length)}
            </button>
          )}
          {(expanded || hidden.length === 0) && hidden.length > 0 && (
            <div id={olderVersionsId} className="mt-1">
              {hidden.map((item) => (
                <VersionRow
                  key={item.run_id}
                  item={item}
                  active={item.run_id === activeRunId}
                />
              ))}
            </div>
          )}
          <div className={hidden.length > 0 && !expanded ? "mt-1" : undefined}>
            {visible.map((item) => (
              <VersionRow
                key={item.run_id}
                item={item}
                active={item.run_id === activeRunId}
              />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
