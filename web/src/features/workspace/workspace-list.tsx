"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { listWorkspaces, seedSampleWorkspace, workspacesQueryKey } from "@/lib/api/workspaces";
import { ApiError } from "@/lib/api/client";
import { parseApiDetail } from "@/lib/api/types-helpers";
import { heatCtaClass } from "@/lib/cta-classes";
import { cn } from "@/lib/utils";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function WorkspaceList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: workspacesQueryKey(),
    queryFn: () => listWorkspaces({ limit: 50 }),
  });

  const seedMutation = useMutation({
    mutationFn: seedSampleWorkspace,
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey() });
      toast.success("Example workspace loaded");
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
        Could not load workspaces. Is the API running?
      </p>
    );
  }

  const workspaces = data?.workspaces ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-sans text-meta font-semibold uppercase tracking-widest text-cta">
            Workspaces
          </p>
          <h1 className="mt-2 font-sans text-display-home font-semibold tracking-tight text-ink md:text-display-md">
            Your startup ideas
          </h1>
          <p className="mt-2 max-w-prose font-sans text-body text-ink-muted">
            Structured worksheets, validation evidence, and judge critiques in one place.
          </p>
        </div>
        <Link href="/workspaces/new" className={cn(heatCtaClass, "inline-flex gap-2")}>
          <Plus className="size-4" aria-hidden />
          New workspace
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <p className="font-sans text-body text-ink-muted">
            No workspaces yet. Start with a structured worksheet or explore a full example loop.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/workspaces/new">Create your first workspace</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={seedMutation.isPending}
              onClick={() => seedMutation.mutate()}
            >
              {seedMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="mr-2 size-4" aria-hidden />
              )}
              Load example
            </Button>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Workspaces">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link href={`/workspaces/${ws.id}`}>
                <Card className="p-4 transition-colors hover:border-cta/30 hover:bg-paper-2">
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
                    <Badge variant="default">{LIFECYCLE_LABEL[ws.lifecycle] ?? ws.lifecycle}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
