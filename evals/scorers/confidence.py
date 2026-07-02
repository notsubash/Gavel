"""Confidence movement plausibility checks for eval runs."""

from __future__ import annotations

from typing import Any

from judges.confidence import confidence_before_after, snapshot_from_payload


def score_confidence_movement(
    debate_result: dict[str, Any] | None,
    appeal_result: dict[str, Any] | None,
) -> dict[str, Any]:
    if not debate_result or not appeal_result or not appeal_result.get("success"):
        return {
            "confidence_present": False,
            "large_jump_without_evidence": False,
            "max_dimension_jump": 0,
        }

    revised_structured = appeal_result.get("revised_structured_synthesis")
    movement = confidence_before_after(
        debate_result,
        revised_structured if isinstance(revised_structured, dict) else None,
    )
    if not movement:
        return {
            "confidence_present": False,
            "large_jump_without_evidence": False,
            "max_dimension_jump": 0,
        }

    before = snapshot_from_payload(movement.get("before"))
    after = snapshot_from_payload(movement.get("after"))
    if before is None or after is None:
        return {
            "confidence_present": False,
            "large_jump_without_evidence": False,
            "max_dimension_jump": 0,
        }

    max_jump = 0
    for prior in before.dimensions:
        nxt = next(
            (item for item in after.dimensions if item.dimension == prior.dimension),
            None,
        )
        if nxt is None:
            continue
        max_jump = max(max_jump, abs(nxt.value - prior.value))

    # ponytail: >25pt jump with no positive judge movement is a drift signal
    positive_moves = int(appeal_result.get("positive_moves") or 0)
    large_jump_without_evidence = max_jump >= 25 and positive_moves == 0

    return {
        "confidence_present": True,
        "large_jump_without_evidence": large_jump_without_evidence,
        "max_dimension_jump": max_jump,
    }
