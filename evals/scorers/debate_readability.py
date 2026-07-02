"""Phase 8 eval gates — debate consequence clarity and lens recognizability in synthesis."""

from __future__ import annotations

import re
from typing import Any

from judges.synthesis import parse_structured_synthesis
from verification.lens import JUDGE_ROLE_NAMES, assess_lens_uniqueness

_ROLE_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(name) for name in JUDGE_ROLE_NAMES.values()) + r")\b",
    re.I,
)


def _score_movements_explained(
    initial_verdicts: list[dict[str, Any]] | None,
    revised_verdicts: list[dict[str, Any]] | None,
) -> tuple[bool, list[str]]:
    if not initial_verdicts or not revised_verdicts:
        return True, []

    originals = {
        str(item.get("judge")): item for item in initial_verdicts if isinstance(item, dict)
    }
    unexplained: list[str] = []
    for revised in revised_verdicts:
        if not isinstance(revised, dict):
            continue
        judge = str(revised.get("judge", ""))
        original = originals.get(judge)
        if not original:
            continue
        orig_score = original.get("score")
        new_score = revised.get("score")
        if not isinstance(orig_score, (int, float)) or not isinstance(new_score, (int, float)):
            continue
        if int(orig_score) == int(new_score):
            continue
        reason = (revised.get("evidence_to_change_verdict") or "").strip()
        if not reason:
            unexplained.append(judge)
    return len(unexplained) == 0, unexplained


def score_debate_readability(
    debate_result: dict[str, Any] | None,
    *,
    verdicts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Structural checks for Phase 8 debate consequence and lens identity."""
    if not debate_result:
        return {
            "debate_readability_legacy": True,
            "debate_consequence_clarity_passed": True,
            "lens_recognizability_passed": True,
            "debate_readability_passed": True,
        }

    structured = parse_structured_synthesis(debate_result)
    legacy = structured is None
    disagreement = (structured.biggest_disagreement or "").strip() if structured else ""
    unresolved = ""
    if structured:
        unresolved = (structured.highest_priority or "").strip()
        if not unresolved and structured.top_risks:
            unresolved = structured.top_risks[0].strip()
        if not unresolved and structured.top_problems:
            unresolved = structured.top_problems[0].strip()

    consequence_ok = bool(disagreement) and bool(unresolved)
    roles_named = bool(_ROLE_PATTERN.search(disagreement)) if disagreement else False

    lens = assess_lens_uniqueness(verdicts or [])
    lens_ok = lens.get("lens_uniqueness_passed", True) if not lens.get("lens_legacy") else True
    lens_recognizable = lens_ok and (roles_named or legacy)

    movements_ok, unexplained = _score_movements_explained(
        debate_result.get("initial_verdicts"),
        debate_result.get("revised_verdicts"),
    )

    passed = (legacy or consequence_ok) and lens_recognizable and movements_ok

    return {
        "debate_readability_legacy": legacy,
        "debate_consequence_clarity_passed": legacy or consequence_ok,
        "lens_recognizability_passed": lens_recognizable,
        "debate_movements_explained": movements_ok,
        "debate_unexplained_movements": unexplained,
        "debate_disagreement_names_roles": roles_named,
        "debate_readability_passed": passed,
    }
