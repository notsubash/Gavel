"use client";

import type { ValidationOverview } from "@/lib/api/workspaces";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export function ValidationProgressChecklist({
  overview,
  isLoading,
  isError,
  onRetry,
}: {
  overview: ValidationOverview | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section aria-labelledby="checklist-heading" aria-busy="true">
        <h2 id="checklist-heading" className="font-sans text-section font-semibold text-ink">
          Validation progress
        </h2>
        <Skeleton className="mt-3 h-32 w-full" />
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-labelledby="checklist-heading">
        <h2 id="checklist-heading" className="font-sans text-section font-semibold text-ink">
          Validation progress
        </h2>
        <Card className="mt-3 p-5">
          <p className="font-sans text-body text-fail" role="alert">
            Could not load validation progress.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 font-sans text-sm font-semibold text-cta hover:underline"
          >
            Retry
          </button>
        </Card>
      </section>
    );
  }

  if (!overview) return null;

  return (
    <section aria-labelledby="checklist-heading">
      <h2 id="checklist-heading" className="font-sans text-section font-semibold text-ink">
        Validation progress
      </h2>
      <Card className="mt-3 space-y-4 p-5">
        <p className="font-sans text-body text-ink">{overview.checklist.next_action}</p>
        <div className="flex flex-wrap gap-2">
          {overview.checklist.items.map((item) => (
            <Badge
              key={item.stage}
              id={`stage-${item.stage}`}
              variant={item.completed ? "pass" : "default"}
              title={item.label}
              className="scroll-mt-24"
            >
              {item.completed ? "✓" : "○"} {item.label}
            </Badge>
          ))}
        </div>
      </Card>
    </section>
  );
}
