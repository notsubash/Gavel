from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from evals.scorers.debate_readability import score_debate_readability


class DebateReadabilityScorerTests(unittest.TestCase):
    def test_legacy_debate_skips_gate(self):
        result = score_debate_readability(None)
        self.assertTrue(result["debate_readability_legacy"])
        self.assertTrue(result["debate_readability_passed"])

    def test_structured_synthesis_passes_when_roles_named(self):
        debate_result = {
            "structured_synthesis": {
                "overall_recommendation": "ITERATE",
                "confidence": "MEDIUM",
                "biggest_disagreement": "VC and PM disagree on wedge size.",
                "highest_priority": "Validate buyer willingness to pay.",
                "top_problems": ["No buyer proof."],
            },
            "initial_verdicts": [{"judge": "vc", "score": 3}],
            "revised_verdicts": [
                {
                    "judge": "vc",
                    "score": 5,
                    "evidence_to_change_verdict": "Engineer argument shifted risk framing.",
                }
            ],
        }
        verdicts = [
            {
                "judge": "vc",
                "verdict": "CONDITIONAL",
                "score": 5,
                "roast": "Better after debate.",
                "key_concern": "Still needs proof.",
                "evidence_to_change_verdict": "Three LOIs.",
            }
        ]
        result = score_debate_readability(debate_result, verdicts=verdicts)
        self.assertFalse(result["debate_readability_legacy"])
        self.assertTrue(result["debate_consequence_clarity_passed"])
        self.assertTrue(result["lens_recognizability_passed"])
        self.assertTrue(result["debate_movements_explained"])
        self.assertTrue(result["debate_readability_passed"])

    def test_top_problems_fallback_passes_consequence_gate(self):
        debate_result = {
            "structured_synthesis": {
                "overall_recommendation": "ITERATE",
                "confidence": "MEDIUM",
                "biggest_disagreement": "VC and PM disagree on wedge size.",
                "top_problems": ["Validate buyer willingness to pay."],
            },
            "initial_verdicts": [],
            "revised_verdicts": [],
        }
        result = score_debate_readability(debate_result, verdicts=[])
        self.assertTrue(result["debate_consequence_clarity_passed"])

    def test_flags_unexplained_score_movement(self):
        debate_result = {
            "structured_synthesis": {
                "overall_recommendation": "ITERATE",
                "confidence": "MEDIUM",
                "biggest_disagreement": "Engineer vs Customer on urgency.",
                "highest_priority": "Run five buyer interviews.",
            },
            "initial_verdicts": [{"judge": "vc", "score": 3}],
            "revised_verdicts": [{"judge": "vc", "score": 5}],
        }
        result = score_debate_readability(debate_result, verdicts=[])
        self.assertFalse(result["debate_movements_explained"])
        self.assertIn("vc", result["debate_unexplained_movements"])
        self.assertFalse(result["debate_readability_passed"])


if __name__ == "__main__":
    unittest.main()
