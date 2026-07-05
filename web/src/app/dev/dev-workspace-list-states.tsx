import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { heatCtaClass } from "@/lib/cta-classes";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

/** Static WorkspaceList state panels for /dev (no API). */
export function WorkspaceListStatePanels() {
  return (
    <div className="grid w-full gap-8 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Loading</p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>

      <div className="space-y-3">
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Error</p>
        <p className="font-sans text-body text-fail" role="alert">
          Could not load workspaces. Is the API running?
        </p>
      </div>

      <div className="space-y-3">
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Empty</p>
        <Card className="border-dashed p-8 text-center">
          <p className="font-sans text-body text-ink-muted">
            No workspaces yet. Start with a structured worksheet or explore a full example loop.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/workspaces/new">Create your first workspace</Link>
            </Button>
            <Button type="button" variant="outline">
              <Sparkles className="mr-2 size-4" aria-hidden />
              Load example
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">Success</p>
        <ul className="space-y-3" aria-label="Workspaces">
          <li>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-sans text-lg font-semibold text-ink">ClinicFlow</h2>
                  <p className="mt-1 font-sans text-meta text-ink-muted">Updated Jul 1, 2026 · 3 assumptions</p>
                </div>
                <Badge variant="default">Discovery</Badge>
              </div>
            </Card>
          </li>
        </ul>
        <Link href="/workspaces/new" className={cn(heatCtaClass, "inline-flex gap-2")}>
          <Plus className="size-4" aria-hidden />
          New workspace
        </Link>
      </div>
    </div>
  );
}
