"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  confidenceTier,
  parseConfidenceFromStructuredSynthesis,
  resolveConfidenceSnapshot,
  weakestDimensionAction,
  type ConfidenceDimensionScore,
  type ConfidenceSnapshot,
} from "@/lib/confidence/confidence";
import type { Verdict } from "@/lib/sse/types";
import { cn } from "@/lib/utils";
import { DisclosureChevron } from "@/ui/disclosure-chevron";

import { VERSION_COPY } from "../run/run-page-copy";

function tierClass(tier: ReturnType<typeof confidenceTier>): string {
  switch (tier) {
    case "High":
      return "bg-pass";
    case "Medium":
      return "bg-conditional";
    default:
      return "bg-fail/70";
  }
}

function ConfidenceBar({
  item,
  compact = false,
  delayMs = 0,
}: {
  item: ConfidenceDimensionScore;
  compact?: boolean;
  delayMs?: number;
}) {
  const tier = item.tier;
  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "font-sans font-semibold text-ink",
            compact ? "text-meta" : "text-xs",
          )}
        >
          {item.label}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums text-ink-muted",
            "text-xs",
          )}
        >
          {item.value}/100
          <span aria-hidden> · {tier}</span>
        </span>
      </div>
      <div
        className={cn(
          "overflow-hidden border border-rule-soft bg-paper-2",
          compact ? "h-1.5" : "h-2",
        )}
        role="progressbar"
        aria-valuenow={item.value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.label} confidence: ${item.value} out of 100, ${tier}`}
      >
        <div
          className={cn(
            "h-full motion-reduce:!w-[var(--fill-pct)] motion-reduce:animate-none",
            "animate-progress-fill transition-[width] duration-200 motion-reduce:transition-none",
            tierClass(tier),
          )}
          style={
            {
              "--fill-pct": `${item.value}%`,
              animationDelay: `${delayMs}ms`,
            } as CSSProperties
          }
        />
      </div>
    </div>
  );
}

function ConfidenceWhy({
  snapshot,
  compact = false,
  defaultOpen = false,
}: {
  snapshot: ConfidenceSnapshot;
  compact?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const weakest = snapshot.dimensions.find((item) => item.dimension === snapshot.weakest);
  const supporting = snapshot.dimensions
    .filter((item) => item.driver)
    .sort((left, right) => left.value - right.value)
    .slice(0, 2);
  const nextAction = weakestDimensionAction(snapshot);

  if (!weakest && supporting.length === 0) return null;

  return (
    <div className={cn(compact ? "mt-2" : "mt-3")}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-ink underline decoration-rule-soft underline-offset-4 hover:text-cta"
        aria-expanded={open}
        aria-controls="confidence-why-panel"
        aria-label="See why confidence scores are what they are"
        onClick={() => setOpen((value) => !value)}
      >
        <DisclosureChevron
          className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
        />
        {VERSION_COPY.confidenceWhy}
      </button>
      {open && (
        <div id="confidence-why-panel" className="mt-3 space-y-3 border-l-2 border-rule-soft pl-4">
          {supporting.map((item) => (
            <p key={item.dimension} className="font-sans text-sm leading-relaxed text-ink-muted">
              <span className="font-semibold text-ink">{item.label}:</span> {item.driver}
            </p>
          ))}
          {nextAction && (
            <p className="font-sans text-sm leading-relaxed text-ink">
              <span className="font-semibold">{VERSION_COPY.confidenceNextAction}:</span>{" "}
              {nextAction}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ConfidenceBars({
  verdicts,
  structuredSynthesis,
  snapshot: providedSnapshot,
  className,
  compact = false,
  title = VERSION_COPY.confidenceTitle,
  showWhy = true,
  defaultWhyOpen = false,
}: {
  verdicts?: Verdict[];
  structuredSynthesis?: unknown;
  snapshot?: ConfidenceSnapshot | null;
  className?: string;
  compact?: boolean;
  title?: string;
  showWhy?: boolean;
  defaultWhyOpen?: boolean;
}) {
  const snapshot = useMemo(
    () =>
      resolveConfidenceSnapshot({
        snapshot: providedSnapshot,
        structuredSynthesis,
        verdicts,
        allowDeterministicFallback: !parseConfidenceFromStructuredSynthesis(structuredSynthesis),
      }),
    [providedSnapshot, structuredSynthesis, verdicts],
  );

  if (!snapshot) return null;

  return (
    <section
      className={cn(compact ? "space-y-2" : "space-y-4", className)}
      aria-label={title}
    >
      {!compact && (
        <h3 className="font-sans text-sm font-semibold text-ink">{title}</h3>
      )}
      <div className={cn(compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2")}>
        {snapshot.dimensions.map((item, index) => (
          <ConfidenceBar key={item.dimension} item={item} compact={compact} delayMs={index * 60} />
        ))}
      </div>
      {showWhy && (
        <ConfidenceWhy snapshot={snapshot} compact={compact} defaultOpen={defaultWhyOpen} />
      )}
    </section>
  );
}
