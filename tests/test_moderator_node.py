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

    def with_structured_output(self, _schema):
        class Structured:
            def invoke(self, _messages, **_kwargs):
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


def _moderator_state(*, revised_score: int | None = None) -> dict:
    initial = [
        {
            "judge": "vc",
            "verdict": "FAIL",
            "score": 3,
            "key_concern": "No defensibility.",
        }
    ]
    panel = [
        {
            "judge": "vc",
            "verdict": "FAIL" if (revised_score or 3) <= 3 else "CONDITIONAL",
            "score": revised_score if revised_score is not None else 3,
            "key_concern": "No defensibility.",
        }
    ]
    return {
        "startup_idea": "AI tool that summarizes privacy policies.",
        "verdicts": panel,
        "initial_verdicts": initial,
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
        self.assertIn("Produce a final synthesis of the debate", model.prose_prompts[0])
        self.assertNotIn("overall_recommendation:", model.prose_prompts[0])
        self.assertIn("Judge verdicts (summary):", model.prose_prompts[0])
        self.assertNotIn("Original judge verdicts", model.prose_prompts[0])

    def test_moderator_prompt_shows_pre_and_post_revote_when_scores_moved(self):
        model = StructuredFailModel()
        make_moderator_node(model)(_moderator_state(revised_score=5))

        prompt = model.prose_prompts[0]
        self.assertIn("Pre-debate judge verdicts:", prompt)
        self.assertIn("Post-debate / re-vote judge verdicts", prompt)
        self.assertIn("VC (FAIL, 3/10)", prompt)
        self.assertIn("VC (CONDITIONAL, 5/10)", prompt)


if __name__ == "__main__":
    unittest.main()
