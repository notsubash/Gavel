"""Unit checks for post-roast handoff item construction."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from judges.schemas import RoastPanel, Verdict
from validation.ingest import build_run_handoff


def _verdict(judge: str, **extra) -> Verdict:
    return Verdict(
        judge=judge,
        verdict="FAIL",
        roast="The go-to-market path is unclear and the wedge is too weak to win attention.",
        score=3,
        key_concern="Weak distribution.",
        **extra,
    )


class HandoffIngestTest(unittest.TestCase):
    def test_build_run_handoff_from_verdicts_and_synthesis(self):
        panel = RoastPanel(
            verdicts=[
                _verdict(
                    "vc",
                    recommended_fix="Interview five buyers before the next sprint.",
                    evidence_to_change_verdict="Two signed LOIs from the target ICP.",
                ),
                _verdict("engineer"),
                _verdict("pm"),
                _verdict("customer"),
                _verdict("competitor"),
            ]
        )
        debate_result = {
            "structured_synthesis": {
                "overall_recommendation": "ITERATE",
                "confidence": "MEDIUM",
                "top_problems": [
                    "Buyer urgency is still unproven in live conversations.",
                    "Buyer urgency is still unproven in live conversations.",
                ],
                "biggest_disagreement": "VC wants a narrower wedge than the PM.",
                "recommended_experiment": {
                    "title": "Run five buyer interviews this week.",
                    "audience": "Solo technical founders",
                    "hypothesis": "Buyers rank validation as a top weekly pain.",
                    "questions": [
                        "Do they rank validation in their top three pains?",
                        "What tools do they use today?",
                        "Would they pilot a workflow that saves an hour?",
                    ],
                    "effort_minutes": 120,
                },
            }
        }

        items = build_run_handoff(roast_panel=panel, debate_result=debate_result)
        self.assertGreaterEqual(len(items), 3)
        kinds = {item.kind for item in items}
        self.assertIn("assumption", kinds)
        self.assertIn("evidence_target", kinds)
        self.assertIn("experiment", kinds)
        # Duplicate top_problems collapse via kind+title dedupe.
        assumptions = [i for i in items if i.kind == "assumption"]
        self.assertEqual(len(assumptions), 1)

    def test_build_run_handoff_empty_without_actionable_fields(self):
        panel = RoastPanel(
            verdicts=[
                _verdict("vc"),
                _verdict("engineer"),
                _verdict("pm"),
                _verdict("customer"),
                _verdict("competitor"),
            ]
        )
        self.assertEqual(build_run_handoff(roast_panel=panel, debate_result=None), [])


if __name__ == "__main__":
    unittest.main()
