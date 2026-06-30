"use client";

import Link from "next/link";
import { ArrowRight, Gavel } from "lucide-react";

import type { Verdict } from "@/lib/sse/types";
import { secondaryCtaClass } from "@/lib/cta-classes";
import { cn } from "@/lib/utils";

import { deriveNextActions, NEXT_ACTION_SLOTS } from "./structured-synthesis";

export function NextActionsStrip({
  runId,
  synthesisProse,
  structuredSynthesis,
  verdicts,
  completed,
  appealLink,
  className,
}: {
  runId: string;
  synthesisProse: string | null;
  structuredSynthesis: unknown;
  verdicts: Verdict[];
  completed: boolean;
  appealLink?: { href: string; label: string } | null;
  className?: string;
}) {
  const actions = deriveNextActions(synthesisProse, structuredSynthesis, verdicts);
  const showAppeal = completed && appealLink;

  return (
    <section
      id="next-actions-strip"
      className={cn("mt-6 border-2 border-rule-soft bg-paper-2", className)}
      aria-labelledby="next-actions-heading"
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4 border-b border-rule-soft px-4 py-3 sm:px-5">
        <h3
          id="next-actions-heading"
          className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
        >
          Next actions
        </h3>
        <div
          className={cn(
            "flex flex-wrap gap-2",
            !completed && "invisible pointer-events-none",
          )}
          aria-hidden={!completed}
        >
          <Link href={`/?refine=${runId}`} className={secondaryCtaClass} tabIndex={completed ? 0 : -1}>
            Refine this idea
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Link>
          {showAppeal && (
            <a href={appealLink.href} className={secondaryCtaClass} tabIndex={0}>
              <Gavel className="mr-2 size-4" aria-hidden />
              {appealLink.label}
            </a>
          )}
          {!showAppeal && (
            <span
              className={cn(secondaryCtaClass, "invisible pointer-events-none")}
              aria-hidden
            >
              <Gavel className="mr-2 size-4" aria-hidden />
              Appeal a verdict
            </span>
          )}
        </div>
      </div>

      {/* ponytail: fixed slot count prevents layout shift as verdicts stream in */}
      <ol className="px-4 py-4 sm:px-5" aria-label="Top actions from this verdict">
        {Array.from({ length: NEXT_ACTION_SLOTS }, (_, index) => {
          const action = actions[index];
          return (
            <li
              key={index}
              className="flex min-h-7 gap-3 font-sans text-sm leading-relaxed"
            >
              <span
                className={cn(
                  "w-5 shrink-0 font-mono text-xs font-bold",
                  action ? "text-heat-ink" : "text-transparent",
                )}
                aria-hidden={!action}
              >
                {index + 1}.
              </span>
              <span className={action ? "text-ink" : "text-transparent"} aria-hidden={!action}>
                {action ?? "—"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
