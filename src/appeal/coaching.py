"""Appeal coaching hints derived from panel verdicts.

Keep in sync with web/src/lib/appeal/coaching.ts (client-side fallback).
"""

from dataclasses import dataclass

from config import JUDGE_ORDER
from judges.schemas import RoastPanel, Verdict, VerdictLabel

_APPEAL_PRIORITY = {
    VerdictLabel.FAIL: 0,
    VerdictLabel.CONDITIONAL: 1,
    VerdictLabel.PASS: 2,
}


def appeal_coaching_hint(verdict: Verdict) -> str:
    evidence = (verdict.evidence_to_change_verdict or "").strip()
    if evidence:
        return evidence
    return f"Provide concrete evidence that addresses: {verdict.key_concern.strip()}"


def appeal_coaching_verdicts(panel: RoastPanel) -> list[Verdict]:
    return sorted(
        panel.verdicts,
        key=lambda verdict: (_APPEAL_PRIORITY.get(verdict.verdict, 99), verdict.judge.value),
    )


def normalize_target_judges(judges: list[str] | None) -> tuple[str, ...]:
    """Keep only known judge ids, in panel order."""
    if not judges:
        return ()
    allowed = set(JUDGE_ORDER)
    return tuple(judge for judge in JUDGE_ORDER if judge in allowed and judge in judges)


def appeal_evidence_outcome(original: Verdict, revised: Verdict) -> str:
    """Whether the original evidence ask was satisfied by the appeal."""
    delta = revised.score - original.score
    if delta > 0:
        return "Evidence met"
    if delta < 0:
        return "Not met"
    if original.verdict == VerdictLabel.PASS:
        return "Already passing"
    return "Not met"


@dataclass(frozen=True)
class AppealJudgeOutcome:
    judge: str
    evidence_ask: str
    outcome: str
    targeted: bool
    score_delta: int


def appeal_judge_outcomes(
    baseline: RoastPanel,
    revised: RoastPanel,
    target_judges: tuple[str, ...] = (),
) -> list[AppealJudgeOutcome]:
    """Per-judge evidence ask, founder targeting, and post-appeal outcome."""
    originals = {verdict.judge.value: verdict for verdict in baseline.verdicts}
    outcomes: list[AppealJudgeOutcome] = []
    for revised_verdict in revised.verdicts:
        judge = revised_verdict.judge.value
        original = originals.get(judge)
        if original is None:
            continue
        delta = revised_verdict.score - original.score
        outcomes.append(
            AppealJudgeOutcome(
                judge=judge,
                evidence_ask=appeal_coaching_hint(original),
                outcome=appeal_evidence_outcome(original, revised_verdict),
                targeted=judge in target_judges,
                score_delta=delta,
            )
        )
    return outcomes
