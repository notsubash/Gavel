"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PostRoastHandoff } from "@/features/judges/post-roast-handoff";
import { ReadinessGateModal } from "@/features/judges/readiness-gate-modal";
import { ApiError } from "@/lib/api/client";
import { createRun } from "@/lib/api/runs";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { loadAdvancedSettings } from "@/lib/settings/advanced-settings";
import {
  getReadiness,
  getRunHandoff,
  getWorkspace,
  listWorkspaceRuns,
  readinessBriefing,
  workspaceQueryKey,
} from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export function JudgesView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
  });

  const runsQuery = useQuery({
    queryKey: ["workspace", workspaceId, "runs"],
    queryFn: () => listWorkspaceRuns(workspaceId),
  });

  const readinessQuery = useQuery({
    queryKey: ["workspace", workspaceId, "readiness"],
    queryFn: () => getReadiness(workspaceId),
    enabled: gateOpen,
  });

  const latestRunId = runsQuery.data?.runs[0]?.run_id;
  const handoffQuery = useQuery({
    queryKey: ["run", latestRunId, "handoff"],
    queryFn: () => getRunHandoff(latestRunId!),
    enabled: Boolean(latestRunId),
  });

  const briefingMutation = useMutation({
    mutationFn: () => readinessBriefing(workspaceId),
    onSuccess: (data) => setBriefing(data.briefing),
    onError: () => toast.error("Could not load readiness briefing"),
  });

  const launchMutation = useMutation({
    mutationFn: (readinessOverride: boolean) => {
      const { model_runtime, max_debate_rounds, enable_web_search } = loadAdvancedSettings();
      return createRun({
        workspace_id: workspaceId,
        readiness_override: readinessOverride,
        model_runtime,
        max_debate_rounds,
        enable_web_search,
      });
    },
    onSuccess: (data) => {
      setGateOpen(false);
      router.push(`/run/${data.run_id}`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? parseApiDetail(error.body) : "Could not start roast";
      toast.error(message ?? "Could not start roast");
    },
  });

  const workingName =
    workspaceQuery.data?.current_version.worksheet.working_name ?? "Workspace";

  if (workspaceQuery.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return <p className="font-sans text-sm text-fail">Could not load workspace.</p>;
  }

  const readiness = readinessQuery.data ?? null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
          Judges
        </p>
        <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink">{workingName}</h1>
        <p className="max-w-prose font-sans text-body text-ink-muted">
          Launch a five-judge roast when your worksheet is ready, then turn their evidence asks into
          validation work.
        </p>
      </header>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-sans text-sm font-semibold text-ink">Ready to roast?</p>
          <p className="mt-1 font-sans text-sm text-ink-muted">
            We check worksheet structure and evidence before judges run.
          </p>
        </div>
        <Button type="button" onClick={() => setGateOpen(true)}>
          Launch roast
        </Button>
      </Card>

      <section className="space-y-3">
        <h2 className="font-sans text-section font-semibold text-ink">Run history</h2>
        {runsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {runsQuery.isError ? (
          <div className="space-y-3 border border-rule-soft bg-paper-2 p-4" role="alert">
            <p className="font-sans text-sm text-fail">Could not load run history.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void runsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}
        {runsQuery.data && runsQuery.data.runs.length === 0 ? (
          <p className="font-sans text-sm text-ink-muted">No roasts yet for this workspace.</p>
        ) : null}
        <ul className="space-y-2">
          {(runsQuery.data?.runs ?? []).map((run) => (
            <li key={run.run_id}>
              <Link
                href={`/run/${run.run_id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 border border-rule-soft bg-card px-4 py-3 transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
              >
                <div>
                  <p className="font-sans text-sm font-medium text-ink">{run.idea_preview}</p>
                  <p className="font-mono text-xs text-ink-subtle">
                    Run {run.run_id.slice(0, 8)} · v{run.version}
                  </p>
                </div>
                <Badge variant={run.status === "completed" ? "pass" : "default"}>
                  {run.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {handoffQuery.isLoading && latestRunId ? (
        <Skeleton className="h-32 w-full" aria-label="Loading post-roast handoff" />
      ) : null}

      {handoffQuery.isError ? (
        <div className="space-y-3 border border-rule-soft bg-paper-2 p-4" role="alert">
          <p className="font-sans text-sm text-fail">Could not load post-roast handoff items.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void handoffQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {handoffQuery.data && handoffQuery.data.items.length > 0 ? (
        <PostRoastHandoff workspaceId={workspaceId} items={handoffQuery.data.items} />
      ) : null}

      <ReadinessGateModal
        open={gateOpen}
        onOpenChange={(open) => {
          if (!open) setBriefing(null);
          setGateOpen(open);
        }}
        readiness={readiness}
        readinessLoading={gateOpen && readinessQuery.isLoading}
        readinessError={readinessQuery.isError}
        onRetryReadiness={() => void readinessQuery.refetch()}
        briefing={briefing}
        briefingLoading={briefingMutation.isPending}
        onFetchBriefing={() => briefingMutation.mutate()}
        onLaunch={(override) => launchMutation.mutate(override)}
        launching={launchMutation.isPending}
      />
    </div>
  );
}
