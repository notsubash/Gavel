from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from judges.schemas import RoastPanel, Verdict
from judges.synthesis import (
    ConfidenceLevel,
    OverallRecommendation,
    RecommendedExperiment,
    Synthesis,
    assess_verdict_output_quality,
    is_meta_summary_text,
    parse_structured_synthesis,
    synthesis_compact_summary,
    synthesis_to_prose,
    top_priorities,
)
from memory.context import build_memory_context
from memory.models import IdeaRecord
import tests  # noqa: F401
from utils.transcript_exporter import export_transcript


def _panel(*, recommended_fix: str | None = "Run five buyer interviews this week.") -> RoastPanel:
    return RoastPanel(
        verdicts=[
            Verdict(
                judge="vc",
                verdict="FAIL",
                roast="Distribution is expensive and the market does not look venture scale.",
                score=3,
                key_concern="No urgent buyer.",
                recommended_fix=recommended_fix,
                evidence_to_change_verdict="Three signed LOIs from target buyers.",
            ),
            Verdict(
                judge="engineer",
                verdict="CONDITIONAL",
                roast="The build is feasible, but reliability will be harder than the demo suggests.",
                score=5,
                key_concern="Extraction reliability.",
                recommended_fix="Ship a benchmark on messy real-world documents.",
                evidence_to_change_verdict="A pilot with measured extraction accuracy above 95%.",
            ),
            Verdict(
                judge="pm",
                verdict="FAIL",
                roast="The target user is too broad, so the product will struggle to find a repeatable wedge.",
                score=3,
                key_concern="Unclear wedge.",
                recommended_fix="Pick one narrow ICP and rewrite the pitch around that buyer.",
                evidence_to_change_verdict="One repeatable channel with early conversion data.",
            ),
            Verdict(
                judge="customer",
                verdict="FAIL",
                roast="I would not change my workflow unless this saves obvious time immediately.",
                score=2,
                key_concern="Too much friction.",
                recommended_fix="Prototype the one-click workflow on a single task.",
                evidence_to_change_verdict="Usability test where three users complete the task unaided.",
            ),
            Verdict(
                judge="competitor",
                verdict="FAIL",
                roast="This is easy for incumbents to copy once they see any traction.",
                score=2,
                key_concern="No moat.",
                recommended_fix="Document a proprietary data or distribution advantage.",
                evidence_to_change_verdict="Evidence that incumbents cannot replicate the data source.",
            ),
        ]
    )


def _structured_debate_result() -> dict:
    synthesis = Synthesis(
        overall_recommendation=OverallRecommendation.ITERATE,
        confidence=ConfidenceLevel.MEDIUM,
        top_strengths=["Clear pain point for compliance teams."],
        top_risks=[
            "No proof of buyer urgency yet.",
            "Sales cycles may be too long for the current GTM.",
        ],
        top_problems=[
            "No proof of buyer urgency yet.",
            "Sales cycles may be too long for the current GTM.",
            "Incumbents can copy the core workflow in one sprint.",
        ],
        highest_priority="Prove that compliance leads will pay before the next build sprint.",
        biggest_disagreement="The VC wants a narrower wedge while the PM wants broader TAM.",
        recommended_experiment={
            "title": "Run five buyer interviews with compliance leads this week.",
            "audience": "Compliance leads at mid-size hospitals",
            "hypothesis": "Buyers rank audit prep as a top-three weekly pain.",
            "questions": [
                "Do they rank audit prep in their top three pains unprompted?",
                "What tools do they use today?",
                "Would they pilot a workflow that saves one hour per audit?",
            ],
            "effort_minutes": 120,
        },
    )
    return {
        "debate_messages": [],
        "final_synthesis": synthesis_to_prose(synthesis),
        "structured_synthesis": synthesis.model_dump(),
    }


class SynthesisHelpersTest(unittest.TestCase):
    def test_parse_structured_synthesis_returns_none_for_legacy_records(self):
        self.assertIsNone(parse_structured_synthesis({"final_synthesis": "Too vague to fund."}))

    def test_top_priorities_prefers_top_problems(self):
        synthesis = Synthesis(
            overall_recommendation=OverallRecommendation.NO_GO,
            confidence=ConfidenceLevel.HIGH,
            top_risks=["Every single judge independently concluded this fails."],
            top_problems=["Fix buyer proof first.", "Validate pricing."],
            biggest_disagreement="Judges split on timing.",
        )
        priorities = top_priorities(synthesis, _panel())
        self.assertEqual(priorities, ["Fix buyer proof first.", "Validate pricing."])

    def test_top_priorities_prefers_structured_risks_when_no_problems(self):
        synthesis = Synthesis(
            overall_recommendation=OverallRecommendation.NO_GO,
            confidence=ConfidenceLevel.HIGH,
            top_risks=["Fix buyer proof first.", "Validate pricing."],
            biggest_disagreement="Judges split on timing.",
        )
        priorities = top_priorities(synthesis, _panel())
        self.assertEqual(priorities, ["Fix buyer proof first.", "Validate pricing."])

    def test_reject_meta_top_problems(self):
        synthesis = Synthesis(
            overall_recommendation=OverallRecommendation.NO_GO,
            confidence=ConfidenceLevel.HIGH,
            top_problems=[
                "Every single judge independently concluded this product fails.",
                "Zero switching costs block repeat revenue.",
            ],
            biggest_disagreement="Split on wedge.",
        )
        self.assertEqual(len(synthesis.top_problems), 1)
        self.assertIn("switching costs", synthesis.top_problems[0])

    def test_recommended_experiment_parses(self):
        experiment = RecommendedExperiment(
            title="Run fifteen interviews with video editors who own Stream Decks.",
            audience="Video editors who own Stream Decks",
            hypothesis="Editors rank forgotten shortcuts as a top-three workflow pain.",
            questions=[
                "Do they rank shortcut friction unprompted?",
                "How often do they switch NLEs mid-task?",
                "Would they pay for a fix?",
            ],
            effort_minutes=120,
        )
        synthesis = Synthesis(
            overall_recommendation=OverallRecommendation.NO_GO,
            confidence=ConfidenceLevel.HIGH,
            biggest_disagreement="VC vs PM on wedge.",
            recommended_experiment=experiment,
        )
        parsed = parse_structured_synthesis({"structured_synthesis": synthesis.model_dump()})
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.recommended_experiment.title, experiment.title)

    def test_synthesis_to_prose_includes_problems_and_experiment(self):
        synthesis = Synthesis(
            overall_recommendation=OverallRecommendation.ITERATE,
            confidence=ConfidenceLevel.MEDIUM,
            top_problems=["No buyer proof yet."],
            biggest_disagreement="VC vs PM on wedge.",
            recommended_experiment=RecommendedExperiment(
                title="Run five buyer interviews with compliance leads this week.",
                audience="Compliance leads at mid-size hospitals",
                hypothesis="Buyers rank audit prep as a top-three weekly pain.",
                questions=["Q1?", "Q2?", "Q3?"],
                effort_minutes=120,
            ),
        )
        prose = synthesis_to_prose(synthesis)
        self.assertIn("**Top problems:**", prose)
        self.assertIn("No buyer proof yet.", prose)
        self.assertIn("**Recommended experiment:**", prose)
        self.assertIn("Run five buyer interviews", prose)

    def test_is_meta_summary_text(self):
        self.assertTrue(
            is_meta_summary_text(
                "Every single judge independently concluded this product fails as a venture investment."
            )
        )
        self.assertFalse(is_meta_summary_text("Zero switching costs block repeat revenue."))

    def test_top_priorities_falls_back_to_recommended_fixes(self):
        synthesis = Synthesis(
            overall_recommendation=OverallRecommendation.ITERATE,
            confidence=ConfidenceLevel.LOW,
            biggest_disagreement="Engineer and VC disagree on feasibility.",
        )
        priorities = top_priorities(synthesis, _panel())
        self.assertEqual(len(priorities), 3)
        self.assertIn("Run five buyer interviews this week.", priorities)

    def test_synthesis_compact_summary_uses_structured_fields(self):
        summary = synthesis_compact_summary(_structured_debate_result())
        self.assertIn("ITERATE (MEDIUM)", summary)
        self.assertIn("No proof of buyer urgency yet.", summary)

    def test_build_memory_context_uses_structured_summary(self):
        record = IdeaRecord(
            user_id="user-1",
            idea_text="AI compliance copilot for hospitals",
            roast_panel=_panel(),
            debate_result=_structured_debate_result(),
        )
        context = build_memory_context([record])
        self.assertIn("ITERATE (MEDIUM)", context)
        self.assertIn("No proof of buyer urgency yet.", context)


class StructuredTranscriptExportTest(unittest.TestCase):
    def test_export_includes_structured_verdict_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_transcript(
                "AI compliance copilot for hospitals",
                _panel(),
                _structured_debate_result(),
                output_dir=Path(tmpdir),
            )
            content = path.read_text(encoding="utf-8")
            self.assertIn("## Final Verdict", content)
            self.assertIn("**Recommendation:** ITERATE", content)
            self.assertIn("**Confidence:** MEDIUM", content)
            self.assertIn("### Top Priorities", content)
            self.assertIn("1. No proof of buyer urgency yet.", content)
            self.assertIn("### Highest Priority", content)
            self.assertIn("Prove that compliance leads will pay", content)
            self.assertIn("### Biggest Disagreement", content)
            self.assertIn("VC wants a narrower wedge", content)

    def test_export_structured_verdict_skips_duplicate_top_risks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_transcript(
                "AI compliance copilot for hospitals",
                _panel(),
                _structured_debate_result(),
                output_dir=Path(tmpdir),
            )
            content = path.read_text(encoding="utf-8")
            self.assertIn("### Top Priorities", content)
            self.assertNotIn("### Top Risks", content)


class VerdictOutputQualityTest(unittest.TestCase):
    def test_assess_flags_degenerate_fixes(self):
        identical_fix = "Interview ten target buyers and document their top workflow pain."
        panel = _panel(recommended_fix=identical_fix)
        for verdict in panel.verdicts[1:]:
            verdict.recommended_fix = identical_fix
        quality = assess_verdict_output_quality(panel, _structured_debate_result())
        self.assertTrue(quality["low_confidence"])
        self.assertTrue(quality["degenerate_fixes"])

    def test_assess_flags_prose_fallback(self):
        quality = assess_verdict_output_quality(
            _panel(),
            {"final_synthesis": "Too vague to fund without buyer proof."},
        )
        self.assertTrue(quality["low_confidence"])
        self.assertFalse(quality["structured_synthesis"])

    def test_assess_accepts_numbered_prose_fallback(self):
        quality = assess_verdict_output_quality(
            _panel(),
            {
                "final_synthesis": (
                    "**1. Overall verdict:** FAIL\n"
                    "**2. Final score from 1-10:** 2\n"
                    "**3. Consensus points**\n"
                    "- Buyers are unconvinced."
                ),
            },
        )
        self.assertFalse(quality["low_confidence"])
        self.assertFalse(quality["structured_synthesis"])

    def test_assess_accepts_distinct_actionable_fixes(self):
        quality = assess_verdict_output_quality(_panel(), _structured_debate_result())
        self.assertFalse(quality["low_confidence"])
        self.assertTrue(quality["structured_synthesis"])

    def test_assess_flags_degenerate_panel_scores(self):
        from judges.schemas import VerdictLabel

        panel = RoastPanel(
            verdicts=[
                verdict.model_copy(update={"score": 10, "verdict": VerdictLabel.PASS})
                for verdict in _panel().verdicts
            ]
        )
        quality = assess_verdict_output_quality(panel, _structured_debate_result())
        self.assertTrue(quality["low_confidence"])
        self.assertTrue(
            any("suspiciously uniform" in reason for reason in quality["reasons"])
        )


if __name__ == "__main__":
    unittest.main()
