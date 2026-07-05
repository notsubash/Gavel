"use client";

import { useMemo } from "react";

import type { AppealResponse } from "@/lib/api/types-helpers";
import {
  parseConfidenceFromStructuredSynthesis,
  parseConfidenceMovement,
  type ConfidenceSnapshot,
} from "@/lib/confidence/confidence";
import { appealBaselineVerdicts, appealJudgeOutcomes } from "@/lib/appeal/coaching";
import type { AppealResult, JudgeId, Verdict } from "@/lib/sse/types";
import { JUDGE_ORDER } from "@/lib/sse/types";
import type { ConfidenceLevel } from "@/features/run/structured-synthesis";

import { AppealResultView } from "./appeal-result";
import { EvidenceProgressDelta } from "./evidence-progress-delta";
import { RUN_PAGE_COPY, EVIDENCE_COPY } from "../run/run-page-copy";

function toVerdictMap(panel: AppealResponse["revised_panel"]): Record<JudgeId, Verdict> {
  const map = {} as Record<JudgeId, Verdict>;
  const verdicts = (panel as { verdicts?: unknown[] }).verdicts;
  if (!Array.isArray(verdicts)) return map;
  for (const item of verdicts) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Verdict).judge === "string" &&
      (JUDGE_ORDER as readonly string[]).includes((item as Verdict).judge)
    ) {
      map[(item as Verdict).judge] = item as Verdict;
    }
  }
  return map;
}

function parseTargetJudges(raw: unknown): JudgeId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is JudgeId =>
      typeof item === "string" && (JUDGE_ORDER as readonly string[]).includes(item),
  );
}

function responseToAppeal(result: AppealResponse): AppealResult {
  const originalByJudge = toVerdictMap(result.original_panel);
  const revisedByJudge = toVerdictMap(result.revised_panel);
  const targetJudges = parseTargetJudges(result.target_judges);
  const evidenceOutcomes =
    result.evidence_outcomes?.map((item) => ({
      judge: item.judge as JudgeId,
      evidenceAsk: item.evidence_ask,
      outcome: item.outcome,
      targeted: item.targeted,
      scoreDelta: item.score_delta,
    })) ??
    appealJudgeOutcomes(
      Object.values(originalByJudge),
      Object.values(revisedByJudge),
      targetJudges,
    );

  return {
    appealText: result.appeal_text,
    originalByJudge,
    revisedByJudge,
    revisedSynthesis: result.revised_synthesis,
    revisedStructuredSynthesis:
      result.revised_structured_synthesis &&
      typeof result.revised_structured_synthesis === "object"
        ? (result.revised_structured_synthesis as Record<string, unknown>)
        : null,
    confidenceBeforeAfter: parseConfidenceMovement(result.confidence_before_after),
    targetJudges,
    evidenceOutcomes,
  };
}

export function AppealSection({
  completed,
  baselineVerdicts,
  appeal,
  confidenceBefore,
  confidenceSnapshotBefore,
}: {
  completed: boolean;
  baselineVerdicts: Verdict[];
  appeal: AppealResult | null;
  confidenceBefore: ConfidenceLevel | null;
  confidenceSnapshotBefore?: ConfidenceSnapshot | null;
}) {
  const coachingBaseline = useMemo(
    () => appealBaselineVerdicts(baselineVerdicts),
    [baselineVerdicts],
  );

  if (!completed) return null;
  if (coachingBaseline.length === 0 && !appeal) return null;

  if (!appeal) {
    return (
      <section
        className="mt-8 border-t border-rule-soft pt-8"
        aria-labelledby="appeal-result-heading"
      >
        <h2
          id="appeal-result-heading"
          tabIndex={-1}
          className="scroll-mt-28 font-sans text-section font-semibold text-ink"
        >
          {EVIDENCE_COPY.progressTitle}
        </h2>
        <p className="mt-3 max-w-prose font-sans text-body text-ink-muted">
          {RUN_PAGE_COPY.appealPlaceholder}
        </p>
      </section>
    );
  }

  const confidenceMovement =
    appeal.confidenceBeforeAfter ??
    (confidenceSnapshotBefore
      ? {
          before: confidenceSnapshotBefore,
          after: parseConfidenceFromStructuredSynthesis(appeal.revisedStructuredSynthesis),
        }
      : null);

  return (
    <div className="mt-8 border-t border-rule-soft pt-8">
      <EvidenceProgressDelta
        appeal={appeal}
        confidenceBefore={confidenceBefore}
        confidenceMovement={confidenceMovement ?? undefined}
        className="mb-8"
      />
      <AppealResultView appeal={appeal} embedded />
    </div>
  );
}

export { responseToAppeal };
