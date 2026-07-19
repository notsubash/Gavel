"use client";

import type { ChecklistItem } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

type ValidationProgressSectionProps = {
  workspaceId: string;
  items: ChecklistItem[];
};

/** Progress only — not alternate CTAs (Phase 1). */
export function ValidationProgressSection({
  workspaceId: _workspaceId,
  items,
}: ValidationProgressSectionProps) {
  const done = items.filter((i) => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="sr-only">
        Validation stage progress
      </h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between font-sans text-meta text-ink-muted">
          <span>Validation progress</span>
          <span>
            {done}/{total} stages
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-paper-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct}% of validation stages complete`}
        >
          <div
            className="h-full rounded-full bg-cta transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Validation stages">
          {items.map((item) => (
            <span
              key={item.stage}
              title={item.label}
              className={cn(
                "inline-flex min-h-8 items-center rounded-ui px-2 py-1 font-sans text-xs",
                item.completed ? "bg-pass/15 text-pass" : "bg-paper-2 text-ink-muted",
              )}
            >
              {item.stage.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
