"use client";

import Link from "next/link";

import { derivePrimaryAction } from "@/features/workspace/derive-primary-action";
import { OVERVIEW_FALLBACK_NEXT_ACTION } from "@/features/workspace/workspace-overview-labels";
import type { ValidationOverview, WorkspaceLifecycle } from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

type NextStepHeroProps = {
  workspaceId: string;
  lifecycle: WorkspaceLifecycle;
  overview: ValidationOverview | null | undefined;
  overviewLoading: boolean;
  overviewError: boolean;
  coachNarrative: string | null;
  onRetryOverview?: () => void;
};

export function NextStepHero({
  workspaceId,
  lifecycle,
  overview,
  overviewLoading,
  overviewError,
  coachNarrative,
  onRetryOverview,
}: NextStepHeroProps) {
  const primary = derivePrimaryAction(workspaceId, lifecycle, overview);
  const nextAction = overview?.checklist.next_action ?? OVERVIEW_FALLBACK_NEXT_ACTION;

  return (
    <section aria-labelledby="next-step-heading" className="space-y-3">
      <h2 id="next-step-heading" className="font-sans text-section font-semibold text-ink">
        What to do next
      </h2>

      {overviewLoading ? (
        <Card className="p-5">
          <Skeleton className="h-5 w-full max-w-md" />
          <Skeleton className="mt-4 h-11 w-40" />
        </Card>
      ) : (
        <Card className="p-5">
          {overviewError && (
            <p className="mb-3 font-sans text-sm text-fail" role="alert">
              Validation status unavailable.{" "}
              {onRetryOverview && (
                <button
                  type="button"
                  className="font-semibold text-cta underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                  onClick={onRetryOverview}
                >
                  Retry
                </button>
              )}
            </p>
          )}
          <p className="font-sans text-body text-ink">{nextAction}</p>
          {coachNarrative && (
            <p className="mt-3 border-t border-rule-soft pt-3 font-sans text-sm text-ink-muted">
              <Badge variant="heat" className="mb-2">
                AI coach
              </Badge>
              <span className="block">{coachNarrative}</span>
            </p>
          )}
          <div className="mt-4">
            <Button asChild>
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}
