"""Appeal coaching hints derived from panel verdicts."""

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
