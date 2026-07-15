"use client";

import { ScoreRadar, scoreRadarData } from "@/features/run/score-radar";
import { JUDGE_ORDER, type JudgeView } from "@/lib/sse/types";
import { initialRunState } from "@/lib/sse/run-reducer";

export function DevScoreRadarPanel({
  partialJudges,
}: {
  partialJudges: Record<(typeof JUDGE_ORDER)[number], JudgeView>;
}) {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <div>
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-ink-muted">Empty</p>
        <ScoreRadar judges={initialRunState().judges} />
      </div>
      <div>
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-ink-muted">Partial</p>
        <ScoreRadar judges={partialJudges} />
        <p className="mt-2 font-mono text-xs text-ink-subtle">
          {scoreRadarData(partialJudges)
            .filter((d) => d.score !== null)
            .map((d) => `${d.judge}: ${d.score}`)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
