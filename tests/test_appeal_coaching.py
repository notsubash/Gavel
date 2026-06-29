from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from appeal.coaching import appeal_coaching_hint, appeal_coaching_verdicts
from judges.schemas import RoastPanel, Verdict, VerdictLabel, judgeLabel

SAMPLE_EVIDENCE = "Three signed LOIs from target buyers would change this verdict."


def _verdict(
    judge: judgeLabel,
    *,
    verdict: VerdictLabel,
    score: int,
    key_concern: str,
    evidence: str | None = None,
) -> Verdict:
    return Verdict(
        judge=judge,
        verdict=verdict,
        roast="This pitch still leaves material gaps the founder must close.",
        score=score,
        key_concern=key_concern,
        evidence_to_change_verdict=evidence,
    )


class AppealCoachingTests(unittest.TestCase):
    def test_uses_evidence_when_present(self):
        verdict = _verdict(
            judgeLabel.VC,
            verdict=VerdictLabel.CONDITIONAL,
            score=5,
            key_concern="No repeatable GTM motion yet.",
            evidence=SAMPLE_EVIDENCE,
        )
        self.assertEqual(appeal_coaching_hint(verdict), SAMPLE_EVIDENCE)

    def test_falls_back_to_key_concern(self):
        verdict = _verdict(
            judgeLabel.CUSTOMER,
            verdict=VerdictLabel.FAIL,
            score=2,
            key_concern="No proof buyers will switch from incumbents.",
        )
        hint = appeal_coaching_hint(verdict)
        self.assertIn("No proof buyers will switch from incumbents.", hint)
        self.assertNotIn(SAMPLE_EVIDENCE, hint)

    def test_whitespace_only_evidence_falls_back_to_key_concern(self):
        verdict = Verdict.model_construct(
            judge=judgeLabel.VC,
            verdict=VerdictLabel.FAIL,
            roast="This pitch still leaves material gaps the founder must close.",
            score=2,
            key_concern="No traction signal yet.",
            evidence_to_change_verdict="   ",
        )
        self.assertIn("No traction signal yet.", appeal_coaching_hint(verdict))

    def test_sorts_fail_and_conditional_before_pass(self):
        panel = RoastPanel(
            verdicts=[
                _verdict(
                    judgeLabel.VC,
                    verdict=VerdictLabel.PASS,
                    score=8,
                    key_concern="Minor scale risk.",
                    evidence="Already a pass.",
                ),
                _verdict(
                    judgeLabel.ENGINEER,
                    verdict=VerdictLabel.FAIL,
                    score=2,
                    key_concern="No technical moat.",
                    evidence="Pilot with 95% accuracy.",
                ),
                _verdict(
                    judgeLabel.PM,
                    verdict=VerdictLabel.CONDITIONAL,
                    score=5,
                    key_concern="Unclear wedge.",
                    evidence="One repeatable channel with conversion data.",
                ),
                _verdict(
                    judgeLabel.CUSTOMER,
                    verdict=VerdictLabel.PASS,
                    score=7,
                    key_concern="Onboarding friction remains.",
                    evidence="Usability test with three successful completions.",
                ),
                _verdict(
                    judgeLabel.COMPETITOR,
                    verdict=VerdictLabel.CONDITIONAL,
                    score=4,
                    key_concern="Incumbents can copy quickly.",
                    evidence="Exclusive data partnership blocking replication.",
                ),
            ]
        )
        ordered = appeal_coaching_verdicts(panel)
        self.assertEqual(
            [verdict.judge for verdict in ordered],
            [
                judgeLabel.ENGINEER,
                judgeLabel.COMPETITOR,
                judgeLabel.PM,
                judgeLabel.CUSTOMER,
                judgeLabel.VC,
            ],
        )
        self.assertEqual(
            [verdict.verdict for verdict in ordered],
            [
                VerdictLabel.FAIL,
                VerdictLabel.CONDITIONAL,
                VerdictLabel.CONDITIONAL,
                VerdictLabel.PASS,
                VerdictLabel.PASS,
            ],
        )


if __name__ == "__main__":
    unittest.main()
