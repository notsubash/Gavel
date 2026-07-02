import { JUDGE_META } from "../sse/judges.ts";
import type { JudgeId, Verdict } from "../sse/types.ts";

import {
  deriveHighestPriority,
  parseDecisionVerdictProse,
  parseStructuredSynthesis,
} from "../../features/run/structured-synthesis.ts";

export interface ScoreMovement {
  judge: JudgeId;
  alias: string;
  lensTag: string;
  fromScore: number;
  toScore: number;
  delta: number;
  reason: string | null;
}

export interface DebateConsequence {
  disagreement: string | null;
  movements: ScoreMovement[];
  unresolvedRisk: string | null;
  scoresMoved: boolean;
}

function parseStructured(structuredSynthesis: unknown, synthesisProse: string | null) {
  return (
    parseStructuredSynthesis(structuredSynthesis) ??
    (synthesisProse ? parseDecisionVerdictProse(synthesisProse) : null)
  );
}

/** Deterministic debate outcome summary — no extra LLM calls. */
export function deriveDebateConsequence(input: {
  structuredSynthesis: unknown;
  synthesisProse: string | null;
  verdicts: Verdict[];
  revoteBaseline: Partial<Record<JudgeId, Verdict>>;
  revoteChangeReasons: Partial<Record<JudgeId, string>>;
  topProblems?: string[];
}): DebateConsequence | null {
  const structured = parseStructured(input.structuredSynthesis, input.synthesisProse);
  const disagreement = structured?.biggest_disagreement?.trim() || null;

  const movements: ScoreMovement[] = [];
  for (const verdict of input.verdicts) {
    const baseline = input.revoteBaseline[verdict.judge];
    if (!baseline || baseline.score === verdict.score) continue;
    const meta = JUDGE_META[verdict.judge];
    const reason =
      input.revoteChangeReasons[verdict.judge]?.trim() ||
      verdict.evidence_to_change_verdict?.trim() ||
      null;
    movements.push({
      judge: verdict.judge,
      alias: meta.name,
      lensTag: meta.lensTag,
      fromScore: baseline.score,
      toScore: verdict.score,
      delta: verdict.score - baseline.score,
      reason,
    });
  }
  movements.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  const problems = input.topProblems ?? [];
  const unresolvedRisk =
    deriveHighestPriority(structured, problems) ||
    structured?.top_risks?.[0]?.trim() ||
    problems[0]?.trim() ||
    null;

  if (!disagreement && movements.length === 0 && !unresolvedRisk) {
    return null;
  }

  return {
    disagreement,
    movements,
    unresolvedRisk,
    scoresMoved: movements.length > 0,
  };
}
