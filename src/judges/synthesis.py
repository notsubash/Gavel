"""Structured moderator synthesis — parse, format, and compact summaries."""

from enum import StrEnum
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from judges.confidence import ConfidenceDimensionScore
from judges.schemas import RoastPanel, Verdict
from verification import is_degenerate_fixes, is_degenerate_panel

SYNTHESIS_ITEM_MAX_LENGTH = 300
BIGGEST_DISAGREEMENT_MAX_LENGTH = 400
EXPERIMENT_TITLE_MAX_LENGTH = 200
EXPERIMENT_AUDIENCE_MAX_LENGTH = 120
EXPERIMENT_HYPOTHESIS_MAX_LENGTH = 300
_NUMBERED_PROSE_SYNTHESIS = re.compile(r"\*\*1\.\s*Overall verdict:\*\*", re.I)

_META_SUMMARY_PATTERNS = (
    re.compile(r"\bevery (single )?judge\b", re.I),
    re.compile(r"\bindependently concluded\b", re.I),
    re.compile(r"\bscoring it between\b", re.I),
    re.compile(r"\bacross all (five )?(perspectives|judges|lenses)\b", re.I),
    re.compile(r"\ball five judges\b", re.I),
)


def is_meta_summary_text(text: str) -> bool:
    """Guardrail: panel aggregate commentary is not an idea problem."""
    normalized = text.lower()
    if any(pattern.search(normalized) for pattern in _META_SUMMARY_PATTERNS):
        return True
    return bool(
        re.search(r"\bunanimous(ly)?\b", normalized)
        and re.search(r"\b(judge|panel|verdict)\b", normalized)
    )


def is_numbered_prose_synthesis(text: str | None) -> bool:
    """True when moderator prose fallback matches the expected five-section shape."""
    return bool(text and _NUMBERED_PROSE_SYNTHESIS.search(text))


class OverallRecommendation(StrEnum):
    GO = "GO"
    ITERATE = "ITERATE"
    NO_GO = "NO-GO"


class ConfidenceLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RecommendedExperiment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=10, max_length=EXPERIMENT_TITLE_MAX_LENGTH)
    audience: str = Field(min_length=5, max_length=EXPERIMENT_AUDIENCE_MAX_LENGTH)
    hypothesis: str = Field(min_length=10, max_length=EXPERIMENT_HYPOTHESIS_MAX_LENGTH)
    questions: list[str] = Field(min_length=3, max_length=5)
    effort_minutes: int = Field(ge=15, le=2880)

    @field_validator("questions", mode="before")
    @classmethod
    def trim_questions(cls, value):
        if not isinstance(value, list):
            return value
        return [item for item in value if isinstance(item, str) and item.strip()][:5]

    @field_validator("questions")
    @classmethod
    def validate_questions(cls, items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in items:
            text = " ".join(item.split())
            if len(text) > SYNTHESIS_ITEM_MAX_LENGTH:
                text = text[: SYNTHESIS_ITEM_MAX_LENGTH - 3].rstrip() + "..."
            cleaned.append(text)
        return cleaned


class Synthesis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_recommendation: OverallRecommendation
    confidence: ConfidenceLevel
    top_strengths: list[str] = Field(default_factory=list, max_length=3)
    top_risks: list[str] = Field(default_factory=list, max_length=3)
    top_problems: list[str] = Field(
        default_factory=list,
        max_length=3,
        description="Concrete flaws in the idea or business — never panel score summaries.",
    )
    highest_priority: str | None = Field(
        default=None,
        max_length=BIGGEST_DISAGREEMENT_MAX_LENGTH,
        description="The single most urgent uncertainty or blocker the founder must resolve first.",
    )
    biggest_disagreement: str = Field(
        min_length=5,
        max_length=BIGGEST_DISAGREEMENT_MAX_LENGTH,
        description="The single biggest point of disagreement among judges.",
    )
    recommended_experiment: RecommendedExperiment | None = None
    confidence_dimensions: list[ConfidenceDimensionScore] = Field(
        default_factory=list,
        max_length=4,
        description="Per-dimension confidence gauges grounded in judge debate.",
    )

    @field_validator("top_strengths", "top_risks", "top_problems", mode="before")
    @classmethod
    def trim_bounded_list(cls, value):
        if not isinstance(value, list):
            return value
        trimmed = [item for item in value if isinstance(item, str) and item.strip()][:3]
        return trimmed

    @field_validator("top_strengths", "top_risks", "top_problems")
    @classmethod
    def validate_list_items(cls, items: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in items:
            text = " ".join(item.split())
            if len(text) > SYNTHESIS_ITEM_MAX_LENGTH:
                text = text[: SYNTHESIS_ITEM_MAX_LENGTH - 3].rstrip() + "..."
            cleaned.append(text)
        return cleaned

    @field_validator("top_problems")
    @classmethod
    def reject_meta_problems(cls, items: list[str]) -> list[str]:
        return [item for item in items if not is_meta_summary_text(item)]


def parse_structured_synthesis(debate_result: dict[str, Any] | None) -> Synthesis | None:
    if not debate_result:
        return None
    raw = debate_result.get("structured_synthesis")
    if raw is None:
        return None
    try:
        return Synthesis.model_validate(raw)
    except Exception:
        return None


def synthesis_to_prose(synthesis: Synthesis) -> str:
    lines = [
        f"**Recommendation:** {synthesis.overall_recommendation.value}",
        f"**Confidence:** {synthesis.confidence.value}",
    ]
    if synthesis.top_strengths:
        lines.append("**Strengths:**")
        lines.extend(f"- {item}" for item in synthesis.top_strengths)
    if synthesis.top_risks:
        lines.append("**Top risks:**")
        lines.extend(f"- {item}" for item in synthesis.top_risks)
    if synthesis.top_problems:
        lines.append("**Top problems:**")
        lines.extend(f"- {item}" for item in synthesis.top_problems)
    if synthesis.highest_priority:
        lines.append(f"**Highest priority:** {synthesis.highest_priority}")
    lines.append(f"**Biggest disagreement:** {synthesis.biggest_disagreement}")
    if synthesis.recommended_experiment is not None:
        exp = synthesis.recommended_experiment
        lines.append(f"**Recommended experiment:** {exp.title}")
    return "\n".join(lines)


def top_priorities(
    synthesis: Synthesis | None,
    roast_panel: RoastPanel | None = None,
    *,
    limit: int = 3,
) -> list[str]:
    if synthesis and synthesis.top_problems:
        return synthesis.top_problems[:limit]

    if synthesis and synthesis.top_risks:
        substantive = [item for item in synthesis.top_risks if not is_meta_summary_text(item)]
        if substantive:
            return substantive[:limit]

    if roast_panel is None:
        return []

    verdict_rank = {"FAIL": 0, "CONDITIONAL": 1, "PASS": 2}

    def sort_key(verdict: Verdict) -> tuple[int, int]:
        return (verdict_rank.get(verdict.verdict.value, 9), verdict.score)

    fixes: list[str] = []
    seen: set[str] = set()
    for verdict in sorted(roast_panel.verdicts, key=sort_key):
        fix = (verdict.recommended_fix or "").strip()
        if not fix or fix in seen:
            continue
        seen.add(fix)
        fixes.append(fix)
        if len(fixes) >= limit:
            break
    return fixes


def synthesis_compact_summary(debate_result: dict[str, Any] | None) -> str:
    structured = parse_structured_synthesis(debate_result)
    if structured is not None:
        parts = [
            f"{structured.overall_recommendation.value} ({structured.confidence.value})",
        ]
        if structured.top_risks:
            parts.append("Risks: " + "; ".join(structured.top_risks[:2]))
        elif structured.biggest_disagreement:
            parts.append(structured.biggest_disagreement)
        return " | ".join(parts)

    return str((debate_result or {}).get("final_synthesis") or "")


def assess_verdict_output_quality(
    roast_panel: RoastPanel | None,
    debate_result: dict[str, Any] | None,
) -> dict[str, Any]:
    """Surface degraded output for UI when local models return weak structured content."""
    verdicts = roast_panel.verdicts if roast_panel else []
    structured = parse_structured_synthesis(debate_result)
    reasons: list[str] = []

    if verdicts and is_degenerate_panel(verdicts):
        reasons.append("Initial panel scores are suspiciously uniform.")

    if verdicts and is_degenerate_fixes(verdicts):
        reasons.append("Judges returned near-identical recommended fixes.")

    final_synthesis = str((debate_result or {}).get("final_synthesis") or "")
    if (
        structured is None
        and final_synthesis.strip()
        and not is_numbered_prose_synthesis(final_synthesis)
    ):
        reasons.append("Moderator fell back to free-text synthesis.")

    if structured is not None and structured.confidence == ConfidenceLevel.LOW:
        reasons.append("Moderator reported low confidence in the recommendation.")

    return {
        "low_confidence": bool(reasons),
        "reasons": reasons,
        "structured_synthesis": structured is not None,
        "degenerate_fixes": is_degenerate_fixes(verdicts) if verdicts else False,
    }
