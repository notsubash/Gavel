"use client";

import type { WorksheetFieldChange } from "@/lib/api/workspaces";
import { CORE_WORKSHEET_FIELDS } from "@/features/worksheet/worksheet-core-fields";
import { WORKSHEET_FIELDS } from "@/features/worksheet/worksheet-schema";
import { cn } from "@/lib/utils";

export function coreFieldsChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  for (const field of CORE_WORKSHEET_FIELDS) {
    const oldVal = formatFieldValue(before[field]);
    const newVal = formatFieldValue(after[field]);
    if (oldVal !== newVal) return true;
  }
  return false;
}

export function formatFieldValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function localWorksheetDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): WorksheetFieldChange[] {
  const labels = Object.fromEntries(WORKSHEET_FIELDS.map((f) => [f.name, f.label]));
  labels.trigger_event = "Trigger event";

  const changes: WorksheetFieldChange[] = [];
  for (const [field, label] of Object.entries(labels)) {
    const oldText = formatFieldValue(before[field]);
    const newText = formatFieldValue(after[field]);
    if (oldText !== newText) {
      changes.push({
        field,
        label,
        before: oldText,
        after: newText,
        is_core: CORE_WORKSHEET_FIELDS.has(field),
      });
    }
  }
  return changes;
}

export function WorksheetVersionDiff({
  changes,
  changeSummary,
  className,
}: {
  changes: WorksheetFieldChange[];
  changeSummary?: string | null;
  className?: string;
}) {
  if (changes.length === 0) {
    return (
      <p className={cn("font-sans text-sm text-ink-muted", className)}>
        No field changes from the prior version.
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {changeSummary && (
        <p className="font-sans text-sm text-ink-muted">{changeSummary}</p>
      )}
      <ul className="space-y-3">
        {changes.map((change) => (
          <li
            key={change.field}
            className={cn(
              "rounded-ui border border-rule-soft p-4",
              change.is_core && "border-l-4 border-l-cta",
            )}
          >
            <p className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
              {change.label}
              {change.is_core && (
                <span className="ml-2 normal-case tracking-normal text-cta">core field</span>
              )}
            </p>
            <p className="mt-2 font-sans text-sm text-ink-subtle line-through">{change.before}</p>
            <p className="mt-1 font-sans text-sm text-ink">{change.after}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
