"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { getWorkspace, workspaceQueryKey } from "@/lib/api/workspaces";
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

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
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
        </div>
        <h1 className="font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
          {ws.working_name}
        </h1>
        <p className="max-w-prose font-sans text-body text-ink-muted">{ws.audience}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/workspaces/${workspaceId}/worksheet`}>Edit worksheet</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/workspaces/${workspaceId}/validation`}>Validation</Link>
          </Button>
        </div>
      </header>

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
            <div>
              <dt className="text-meta font-semibold uppercase tracking-wide text-ink-subtle">
                Top risky assumption
              </dt>
              <dd className="mt-1 text-ink">{ws.top_risky_assumption}</dd>
            </div>
          </dl>
        </Card>
      </section>

      {assumptions.length > 0 && (
        <section aria-labelledby="assumptions-heading">
          <h2 id="assumptions-heading" className="font-sans text-section font-semibold text-ink">
            Assumptions
          </h2>
          <ul className="mt-3 space-y-2">
            {assumptions.map((a) => (
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

      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="font-sans text-section font-semibold text-ink">
          Generated document
        </h2>
        <pre className="mt-3 whitespace-pre-wrap rounded-ui border border-rule-soft bg-paper-2 p-4 font-mono text-sm leading-relaxed text-ink">
          {current_version.generated_document}
        </pre>
      </section>
    </div>
  );
}
