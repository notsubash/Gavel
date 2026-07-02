"use client";

import { useQuery } from "@tanstack/react-query";

import { getRunPanel, runPanelQueryKey } from "@/lib/api/runs";
import { parseConfidenceSnapshot, resolveConfidenceSnapshot } from "@/lib/confidence/confidence";
import { isConfidenceEngineEnabled } from "@/lib/feature-flags";
import { useInView } from "@/lib/hooks/use-in-view";
import { parseVerdict } from "@/lib/lineage/lineage";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";

import { ConfidenceBars } from "../iteration/confidence-bars";

export function HistoryConfidencePreview({
  runId,
  enabled = true,
  className,
}: {
  runId: string;
  enabled?: boolean;
  className?: string;
}) {
  const [ref, inView] = useInView();
  const shouldFetch = enabled && inView && isConfidenceEngineEnabled();

  const panelQuery = useQuery({
    queryKey: runPanelQueryKey(runId),
    queryFn: () => getRunPanel(runId),
    enabled: shouldFetch,
    retry: 1,
    staleTime: 60_000,
  });

  if (!enabled || !isConfidenceEngineEnabled()) return null;

  return (
    <div ref={ref} className={cn(className)}>
      {!inView && <div className="h-16" aria-hidden />}
      {shouldFetch && panelQuery.isLoading && <Skeleton className="h-16 w-full" />}
      {shouldFetch && !panelQuery.isLoading && panelQuery.data && (
        <HistoryConfidenceBars
          panelVerdicts={panelQuery.data.verdicts}
          snapshot={panelQuery.data.confidence_snapshot}
        />
      )}
    </div>
  );
}

function HistoryConfidenceBars({
  panelVerdicts,
  snapshot,
}: {
  panelVerdicts: unknown[];
  snapshot?: unknown;
}) {
  const verdicts = panelVerdicts
    .map(parseVerdict)
    .filter((verdict): verdict is NonNullable<ReturnType<typeof parseVerdict>> => verdict !== null);
  const resolved =
    parseConfidenceSnapshot(snapshot) ??
    resolveConfidenceSnapshot({ verdicts, allowDeterministicFallback: true });
  if (!resolved) return null;
  return <ConfidenceBars snapshot={resolved} compact showWhy={false} />;
}
