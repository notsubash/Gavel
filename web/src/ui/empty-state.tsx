import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared empty-state shell (Phase 5). Title + optional lead + one action slot.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-dashed border-rule-soft bg-paper-2 p-8 text-center md:p-10",
        className,
      )}
    >
      <p className="font-sans text-section font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-2 font-sans text-meta text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex flex-col items-center gap-3">{action}</div> : null}
    </div>
  );
}
