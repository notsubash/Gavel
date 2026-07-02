from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from judges.confidence import (
    ConfidenceDimensionKey,
    ConfidenceDimensionScore,
    apply_confidence_guardrails,
    build_confidence_snapshot,
    confidence_before_after,
    extract_confidence_snapshot,
    snapshot_from_payload,
)
from judges.schemas import Verdict


def _dimension(value: int, dimension: ConfidenceDimensionKey = ConfidenceDimensionKey.DEMAND):
    return ConfidenceDimensionScore(
        dimension=dimension,
        value=value,
        driver="Buyer urgency is still unproven.",
        next_action="Run five paid pilot conversations this week.",
    )


def _verdict(judge: str, verdict: str, score: int) -> Verdict:
    return Verdict(
        judge=judge,
        verdict=verdict,
        roast="The concern remains unresolved after review.",
        score=score,
        key_concern="Needs proof.",
        recommended_fix="Gather proof.",
        evidence_to_change_verdict="Signed LOIs.",
    )


class ConfidenceEngineTest(unittest.TestCase):
    def test_extract_requires_four_dimensions(self):
        structured = {
            "confidence_dimensions": [
                _dimension(35, ConfidenceDimensionKey.DEMAND).model_dump(mode="json"),
            ]
        }
        self.assertIsNone(extract_confidence_snapshot(structured))

    def test_snapshot_from_payload_reads_serialized_snapshot(self):
        snapshot = build_confidence_snapshot(
            [
                _dimension(35, ConfidenceDimensionKey.DEMAND),
                _dimension(55, ConfidenceDimensionKey.PRICING),
                _dimension(45, ConfidenceDimensionKey.COMPETITION),
                _dimension(60, ConfidenceDimensionKey.MOAT),
            ]
        )
        assert snapshot is not None
        parsed = snapshot_from_payload(snapshot.model_dump(mode="json"))
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed.weakest, ConfidenceDimensionKey.DEMAND)

    def test_guardrail_caps_weak_judge_even_below_high_floor(self):
        snapshot = build_confidence_snapshot(
            [
                _dimension(65, ConfidenceDimensionKey.PRICING),
                _dimension(55, ConfidenceDimensionKey.DEMAND),
            ]
        )
        assert snapshot is not None
        guarded = apply_confidence_guardrails(
            snapshot,
            [_verdict("customer", "CONDITIONAL", 2)],
        )
        pricing = next(
            item for item in guarded.dimensions if item.dimension == ConfidenceDimensionKey.PRICING
        )
        self.assertLessEqual(pricing.value, 39)

    def test_confidence_tier_buckets(self):
        from judges.confidence import confidence_tier

        self.assertEqual(confidence_tier(30), "Low")
        self.assertEqual(confidence_tier(55), "Medium")
        self.assertEqual(confidence_tier(75), "High")

    def test_extract_confidence_snapshot_from_structured(self):
        structured = {
            "confidence_dimensions": [
                _dimension(35, ConfidenceDimensionKey.DEMAND).model_dump(mode="json"),
                _dimension(80, ConfidenceDimensionKey.PRICING).model_dump(mode="json"),
                _dimension(50, ConfidenceDimensionKey.COMPETITION).model_dump(mode="json"),
                _dimension(60, ConfidenceDimensionKey.MOAT).model_dump(mode="json"),
            ]
        }
        snapshot = extract_confidence_snapshot(structured)
        self.assertIsNotNone(snapshot)
        assert snapshot is not None
        self.assertEqual(snapshot.weakest, ConfidenceDimensionKey.DEMAND)

    def test_guardrail_caps_high_dimension_with_fail_judge(self):
        snapshot = build_confidence_snapshot(
            [
                _dimension(85, ConfidenceDimensionKey.PRICING),
                _dimension(55, ConfidenceDimensionKey.DEMAND),
            ]
        )
        assert snapshot is not None
        guarded = apply_confidence_guardrails(
            snapshot,
            [_verdict("customer", "FAIL", 2)],
        )
        pricing = next(
            item for item in guarded.dimensions if item.dimension == ConfidenceDimensionKey.PRICING
        )
        self.assertLessEqual(pricing.value, 39)

    def test_confidence_before_after_maps_appeal_movement(self):
        before_structured = {
            "confidence_dimensions": [
                _dimension(30, ConfidenceDimensionKey.DEMAND).model_dump(mode="json"),
                _dimension(40, ConfidenceDimensionKey.PRICING).model_dump(mode="json"),
                _dimension(50, ConfidenceDimensionKey.COMPETITION).model_dump(mode="json"),
                _dimension(60, ConfidenceDimensionKey.MOAT).model_dump(mode="json"),
            ]
        }
        after_structured = {
            "confidence_dimensions": [
                _dimension(55, ConfidenceDimensionKey.DEMAND).model_dump(mode="json"),
                _dimension(60, ConfidenceDimensionKey.PRICING).model_dump(mode="json"),
                _dimension(50, ConfidenceDimensionKey.COMPETITION).model_dump(mode="json"),
                _dimension(60, ConfidenceDimensionKey.MOAT).model_dump(mode="json"),
            ]
        }
        movement = confidence_before_after(
            {"structured_synthesis": before_structured},
            after_structured,
        )
        self.assertIsNotNone(movement)
        assert movement is not None
        pricing_before = next(
            item for item in movement["before"]["dimensions"] if item["dimension"] == "pricing"
        )
        pricing_after = next(
            item for item in movement["after"]["dimensions"] if item["dimension"] == "pricing"
        )
        self.assertEqual(pricing_before["value"], 40)
        self.assertEqual(pricing_after["value"], 60)


class ConfidenceEvalScorerTest(unittest.TestCase):
    def test_score_confidence_movement_reads_serialized_snapshots(self):
        from evals.scorers.confidence import score_confidence_movement

        before = build_confidence_snapshot(
            [
                _dimension(30, ConfidenceDimensionKey.PRICING),
                _dimension(40, ConfidenceDimensionKey.DEMAND),
                _dimension(50, ConfidenceDimensionKey.COMPETITION),
                _dimension(60, ConfidenceDimensionKey.MOAT),
            ]
        )
        after = build_confidence_snapshot(
            [
                _dimension(60, ConfidenceDimensionKey.PRICING),
                _dimension(40, ConfidenceDimensionKey.DEMAND),
                _dimension(50, ConfidenceDimensionKey.COMPETITION),
                _dimension(60, ConfidenceDimensionKey.MOAT),
            ]
        )
        assert before is not None and after is not None
        result = score_confidence_movement(
            {
                "structured_synthesis": {
                    "confidence_dimensions": [
                        item.model_dump(mode="json") for item in before.dimensions
                    ]
                }
            },
            {
                "success": True,
                "revised_structured_synthesis": {
                    "summary": "Evidence helped pricing.",
                    "confidence_dimensions": after.model_dump(mode="json")["dimensions"],
                },
                "positive_moves": 0,
            },
        )
        self.assertTrue(result["confidence_present"])
        self.assertEqual(result["max_dimension_jump"], 30)
        self.assertTrue(result["large_jump_without_evidence"])


if __name__ == "__main__":
    unittest.main()
