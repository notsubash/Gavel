from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from debate.nodes import make_moderator_node
import tests  # noqa: F401


class FakeResponse:
    def __init__(self, content: str):
        self.content = content


class StructuredFailModel:
    def __init__(self):
        self.prose_prompts: list[str] = []
        self.structured_calls = 0

    def with_structured_output(self, _schema):
        model = self

        class Structured:
            def invoke(self, _messages, **_kwargs):
                model.structured_calls += 1
                raise ValueError("structured output unavailable")

        return Structured()

    def invoke(self, messages, **_kwargs):
        self.prose_prompts.append(messages[0]["content"])
        return FakeResponse(
            "**1. Overall verdict:** FAIL\n"
            "**2. Final score from 1-10:** 3\n"
            "**3. Consensus points**\n"
            "- Buyers are unconvinced."
        )


class StructuredRetryModel:
    def __init__(self, responses):
        self.responses = list(responses)
        self.prompts: list[str] = []

    def with_structured_output(self, _schema):
        model = self

        class Structured:
            def invoke(self, messages, **_kwargs):
                model.prompts.append(messages[0]["content"])
                payload = model.responses.pop(0)
                if isinstance(payload, Exception):
                    raise payload
                return payload

        return Structured()


def _moderator_state() -> dict:
    return {
        "startup_idea": "AI tool that summarizes privacy policies.",
        "verdicts": [
            {
                "judge": "vc",
                "verdict": "FAIL",
                "score": 3,
                "roast": "The market is crowded and the wedge is unclear for privacy summaries.",
                "key_concern": "No defensibility.",
                "recommended_fix": "Interview ten privacy-conscious SMB buyers this month.",
                "evidence_to_change_verdict": "Three signed LOIs from target buyers.",
            }
        ],
        "debate_messages": [
            {"speaker": "vc", "round": 1, "content": "Still no moat."},
        ],
        "round": 1,
    }


class ModeratorNodeTest(unittest.TestCase):
    def test_moderator_falls_back_to_legacy_prose_prompt(self):
        model = StructuredFailModel()
        result = make_moderator_node(model)(_moderator_state())

        self.assertIsNone(result["structured_synthesis"])
        self.assertIn("**1. Overall verdict:** FAIL", result["final_synthesis"])
        self.assertEqual(len(model.prose_prompts), 1)
        self.assertEqual(model.structured_calls, 3)
        self.assertIn("Produce a final synthesis of the debate", model.prose_prompts[0])
        self.assertNotIn("overall_recommendation:", model.prose_prompts[0])

    def test_moderator_retries_until_structured_synthesis_passes(self):
        incomplete = {
            "overall_recommendation": "NO-GO",
            "confidence": "LOW",
            "top_problems": [
                "Buyer proof is still missing.",
                "Pricing remains unvalidated.",
                "Incumbents can copy the workflow.",
            ],
            "biggest_disagreement": "VC and PM disagree on wedge timing.",
            "confidence_dimensions": [
                {
                    "dimension": "demand",
                    "value": 20,
                    "driver": "No buyer urgency proof.",
                    "next_action": "Run five buyer interviews.",
                }
            ],
        }
        complete = {
            **incomplete,
            "confidence_dimensions": [
                {
                    "dimension": "demand",
                    "value": 20,
                    "driver": "No buyer urgency proof.",
                    "next_action": "Run five buyer interviews.",
                },
                {
                    "dimension": "pricing",
                    "value": 25,
                    "driver": "Willingness to pay is unclear.",
                    "next_action": "Test two price points.",
                },
                {
                    "dimension": "competition",
                    "value": 30,
                    "driver": "Incumbents can copy the surface workflow.",
                    "next_action": "Document a distribution wedge.",
                },
                {
                    "dimension": "moat",
                    "value": 15,
                    "driver": "No defensibility surfaced in debate.",
                    "next_action": "Identify proprietary data or lock-in.",
                },
            ],
        }
        model = StructuredRetryModel([incomplete, complete])
        result = make_moderator_node(model)(_moderator_state())

        self.assertIsNotNone(result["structured_synthesis"])
        self.assertEqual(len(model.prompts), 2)
        self.assertIn("rejected", model.prompts[1])
        self.assertEqual(len(result["structured_synthesis"]["confidence_dimensions"]), 4)


if __name__ == "__main__":
    unittest.main()
