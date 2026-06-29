"use client";

import { appealCoachingHint, appealCoachingVerdicts } from "@/lib/appeal/coaching";
import { JUDGE_META } from "@/lib/sse/judges";
import type { JudgeId, Verdict } from "@/lib/sse/types";
import { cn } from "@/lib/utils";
import { Label } from "@/ui/label";

const VERDICT_TONE: Record<Verdict["verdict"], string> = {
  PASS: "text-pass",
  FAIL: "text-fail",
  CONDITIONAL: "text-warn",
};

export function AppealCoaching({
  baselineVerdicts,
  targetJudges,
  onTargetChange,
  disabled,
}: {
  baselineVerdicts: Verdict[];
  targetJudges: JudgeId[];
  onTargetChange: (judges: JudgeId[]) => void;
  disabled?: boolean;
}) {
  const ordered = appealCoachingVerdicts(baselineVerdicts);
  const targets = new Set(targetJudges);

  return (
    <div className="mt-6 space-y-3">
      <div>
        <h3 className="font-sans text-sm font-semibold text-ink">
          What would change each judge&apos;s mind
        </h3>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          Check the judges you are addressing. Target FAIL and CONDITIONAL first.
        </p>
      </div>

      <ul className="space-y-3">
        {ordered.map((verdict) => {
          const meta = JUDGE_META[verdict.judge];
          const checked = targets.has(verdict.judge);
          const inputId = `appeal-target-${verdict.judge}`;

          return (
            <li
              key={verdict.judge}
              className="flex gap-3 border border-rule-soft bg-paper-2 p-4"
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => {
                  const next = new Set(targetJudges);
                  if (event.target.checked) next.add(verdict.judge);
                  else next.delete(verdict.judge);
                  onTargetChange([...next]);
                }}
                className="mt-1 size-4 shrink-0 accent-ink"
                aria-describedby={`${inputId}-hint`}
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={inputId}
                  className={cn("font-sans text-sm font-semibold", meta.accentClass.split(" ")[0])}
                >
                  {meta.name}
                  <span className={cn("ml-2 font-mono text-xs", VERDICT_TONE[verdict.verdict])}>
                    {verdict.verdict} · {verdict.score}/10
                  </span>
                </Label>
                <p id={`${inputId}-hint`} className="mt-1 font-sans text-sm text-ink-muted">
                  {appealCoachingHint(verdict)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
