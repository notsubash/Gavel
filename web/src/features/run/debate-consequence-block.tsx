"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { deriveDebateConsequence, type DebateConsequence } from "@/lib/debate/debate-consequence";
import type { JudgeId, Verdict } from "@/lib/sse/types";
import { cn } from "@/lib/utils";

import { RUN_PAGE_COPY } from "./run-page-copy";

function MovementIcon({ delta }: { delta: number }) {
  if (delta > 0) return <ArrowUp className="size-3.5 shrink-0 text-pass" aria-hidden />;
  if (delta < 0) return <ArrowDown className="size-3.5 shrink-0 text-fail" aria-hidden />;
  return <Minus className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />;
}

function ConsequenceSection({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      <h4 className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </h4>
      <div className="font-sans text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export function DebateConsequenceBlock({
  structuredSynthesis,
  synthesisProse,
  verdicts,
  revoteBaseline,
  revoteChangeReasons,
  topProblems,
  className,
}: {
  structuredSynthesis: unknown;
  synthesisProse: string | null;
  verdicts: Verdict[];
  revoteBaseline: Partial<Record<JudgeId, Verdict>>;
  revoteChangeReasons: Partial<Record<JudgeId, string>>;
  topProblems?: string[];
  className?: string;
}) {
  const consequence = deriveDebateConsequence({
    structuredSynthesis,
    synthesisProse,
    verdicts,
    revoteBaseline,
    revoteChangeReasons,
    topProblems,
  });

  if (!consequence) return null;

  return (
    <DebateConsequenceView consequence={consequence} className={className} />
  );
}

export function DebateConsequenceView({
  consequence,
  className,
}: {
  consequence: DebateConsequence;
  className?: string;
}) {
  return (
    <article
      className={cn("border border-rule-soft bg-paper-2 px-5 py-4", className)}
      aria-labelledby="debate-consequence-heading"
    >
      <h3
        id="debate-consequence-heading"
        className="font-sans text-lg font-semibold text-ink"
      >
        {RUN_PAGE_COPY.debateConsequence}
      </h3>
      <p className="mt-1 font-sans text-sm text-ink-muted">
        {RUN_PAGE_COPY.debateConsequenceLead}
      </p>

      <div className="mt-4 space-y-4">
        {consequence.disagreement && (
          <ConsequenceSection label={RUN_PAGE_COPY.debateDisagreement}>
            {consequence.disagreement}
          </ConsequenceSection>
        )}

        <ConsequenceSection label={RUN_PAGE_COPY.debateWhatMoved}>
          {consequence.movements.length > 0 ? (
            <ul className="space-y-2">
              {consequence.movements.map((movement) => (
                <li
                  key={movement.judge}
                  className="flex gap-2 border-l-2 border-rule-soft pl-3"
                >
                  <MovementIcon delta={movement.delta} />
                  <div>
                    <p className="font-medium text-ink">
                      {movement.alias}{" "}
                      <span className="font-mono text-ink-muted">
                        {movement.fromScore}→{movement.toScore}
                      </span>
                      <span className="ml-1 font-mono text-xs text-ink-subtle">
                        ({movement.lensTag})
                      </span>
                    </p>
                    {movement.reason && (
                      <p className="mt-0.5 text-ink-muted">{movement.reason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{RUN_PAGE_COPY.debateNoMovement}</p>
          )}
        </ConsequenceSection>

        {consequence.unresolvedRisk && (
          <ConsequenceSection label={RUN_PAGE_COPY.debateUnresolvedRisk}>
            {consequence.unresolvedRisk}
          </ConsequenceSection>
        )}
      </div>
    </article>
  );
}
