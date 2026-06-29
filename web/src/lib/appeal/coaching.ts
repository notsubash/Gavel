/**
 * Appeal coaching helpers — keep in sync with src/appeal/coaching.py (canonical).
 */
import { JUDGE_ORDER } from "../sse/types.ts";
import type { JudgeId, Verdict, VerdictLabel } from "../sse/types.ts";

const APPEAL_PRIORITY: Record<VerdictLabel, number> = {
  FAIL: 0,
  CONDITIONAL: 1,
  PASS: 2,
};

export function appealCoachingHint(verdict: Verdict): string {
  const evidence = verdict.evidence_to_change_verdict?.trim();
  if (evidence) return evidence;
  return `Provide concrete evidence that addresses: ${verdict.key_concern.trim()}`;
}

export function appealCoachingVerdicts(verdicts: Verdict[]): Verdict[] {
  return [...verdicts].sort((left, right) => {
    const priority =
      APPEAL_PRIORITY[left.verdict] - APPEAL_PRIORITY[right.verdict];
    if (priority !== 0) return priority;
    return (
      JUDGE_ORDER.indexOf(left.judge) - JUDGE_ORDER.indexOf(right.judge)
    );
  });
}

export function normalizeTargetJudges(judges: JudgeId[] | undefined): JudgeId[] {
  if (!judges?.length) return [];
  const allowed = new Set(JUDGE_ORDER);
  return JUDGE_ORDER.filter((judge) => allowed.has(judge) && judges.includes(judge));
}

export function appealEvidenceOutcome(
  original: Verdict,
  revised: Verdict,
): string {
  const delta = revised.score - original.score;
  if (delta > 0) return "Evidence met";
  if (delta < 0) return "Not met";
  if (original.verdict === "PASS") return "Already passing";
  return "Not met";
}

export interface AppealJudgeOutcome {
  judge: JudgeId;
  evidenceAsk: string;
  outcome: string;
  targeted: boolean;
  scoreDelta: number;
}

export function appealJudgeOutcomes(
  baseline: Verdict[],
  revised: Verdict[],
  targetJudges: JudgeId[] = [],
): AppealJudgeOutcome[] {
  const originals = new Map(baseline.map((verdict) => [verdict.judge, verdict]));
  const targets = new Set(normalizeTargetJudges(targetJudges));
  return revised.flatMap((revisedVerdict) => {
    const original = originals.get(revisedVerdict.judge);
    if (!original) return [];
    const scoreDelta = revisedVerdict.score - original.score;
    return [
      {
        judge: revisedVerdict.judge,
        evidenceAsk: appealCoachingHint(original),
        outcome: appealEvidenceOutcome(original, revisedVerdict),
        targeted: targets.has(revisedVerdict.judge),
        scoreDelta,
      },
    ];
  });
}
