"""LLM-sourced confidence dimensions with lightweight guardrails."""

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from judges.schemas import Verdict

CONFIDENCE_DIMENSIONS = ("demand", "pricing", "competition", "moat")

DIMENSION_LABELS: dict[str, str] = {
    "demand": "Demand",
    "pricing": "Pricing",
    "competition": "Competition",
    "moat": "Moat",
}

# ponytail: fixed judge→dimension map for contradiction guardrails only.
DIMENSION_JUDGES: dict[str, tuple[str, ...]] = {
    "demand": ("pm", "customer"),
    "pricing": ("customer",),
    "competition": ("competitor",),
    "moat": ("vc", "engineer"),
}

HIGH_CONTRADICTION_SCORE = 3
LOW_CONFIDENCE_CAP = 39


class ConfidenceDimensionKey(StrEnum):
    DEMAND = "demand"
    PRICING = "pricing"
    COMPETITION = "competition"
    MOAT = "moat"


class ConfidenceDimensionScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimension: ConfidenceDimensionKey
    value: int = Field(ge=0, le=100)
    driver: str = Field(min_length=5, max_length=300)
    next_action: str = Field(min_length=5, max_length=300)

    @field_validator("driver", "next_action", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return " ".join(value.split())
        return value


class ConfidenceSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimensions: list[ConfidenceDimensionScore] = Field(min_length=1, max_length=4)
    weakest: ConfidenceDimensionKey | None = None
    source: Literal["llm", "deterministic"] = "llm"

    @field_validator("weakest", mode="before")
    @classmethod
    def default_weakest(cls, value: Any, info) -> Any:
        if value is not None:
            return value
        dimensions = info.data.get("dimensions") if hasattr(info, "data") else None
        if not dimensions:
            return None
        return min(dimensions, key=lambda item: item.value).dimension


def confidence_tier(value: int) -> str:
    if value < 40:
        return "Low"
    if value < 70:
        return "Medium"
    return "High"


def _coerce_dimension_entry(raw: Any) -> ConfidenceDimensionScore | None:
    if not isinstance(raw, dict):
        return None
    try:
        return ConfidenceDimensionScore.model_validate(raw)
    except Exception:
        return None


def parse_confidence_dimensions(raw: Any) -> list[ConfidenceDimensionScore]:
    if not isinstance(raw, list):
        return []
    entries: list[ConfidenceDimensionScore] = []
    seen: set[ConfidenceDimensionKey] = set()
    for item in raw:
        entry = _coerce_dimension_entry(item)
        if entry is None or entry.dimension in seen:
            continue
        seen.add(entry.dimension)
        entries.append(entry)
    return entries


def build_confidence_snapshot(
    dimensions: list[ConfidenceDimensionScore],
    *,
    source: Literal["llm", "deterministic"] = "llm",
) -> ConfidenceSnapshot | None:
    if not dimensions:
        return None
    weakest = min(dimensions, key=lambda item: item.value).dimension
    return ConfidenceSnapshot(dimensions=dimensions, weakest=weakest, source=source)


def extract_confidence_snapshot(structured: dict[str, Any] | None) -> ConfidenceSnapshot | None:
    if not structured:
        return None
    dimensions = parse_confidence_dimensions(structured.get("confidence_dimensions"))
    # ponytail: partial LLM output is treated as missing; deterministic fallback handles UI.
    if len(dimensions) != 4:
        return None
    return build_confidence_snapshot(dimensions, source="llm")


def _verdicts_by_judge(verdicts: list[Verdict]) -> dict[str, Verdict]:
    return {verdict.judge.value: verdict for verdict in verdicts}


def apply_confidence_guardrails(
    snapshot: ConfidenceSnapshot,
    verdicts: list[Verdict],
) -> ConfidenceSnapshot:
    """Cap dimensions that contradict a weak judge in the same lens."""
    by_judge = _verdicts_by_judge(verdicts)
    adjusted: list[ConfidenceDimensionScore] = []
    for item in snapshot.dimensions:
        value = item.value
        judges = DIMENSION_JUDGES.get(item.dimension.value, ())
        for judge in judges:
            verdict = by_judge.get(judge)
            if verdict is None:
                continue
            if (
                verdict.verdict.value in ("FAIL", "CONDITIONAL")
                and verdict.score <= HIGH_CONTRADICTION_SCORE
            ):
                value = min(value, LOW_CONFIDENCE_CAP)
        adjusted.append(item.model_copy(update={"value": value}) if value != item.value else item)
    return build_confidence_snapshot(adjusted, source=snapshot.source) or snapshot


def snapshot_from_payload(raw: Any) -> ConfidenceSnapshot | None:
    """Parse a serialized ConfidenceSnapshot or structured synthesis dict."""
    if not isinstance(raw, dict):
        return None
    if "dimensions" in raw:
        try:
            return ConfidenceSnapshot.model_validate(raw)
        except Exception:
            return None
    return extract_confidence_snapshot(raw)


def guard_confidence_dimensions(
    structured: dict[str, Any],
    verdicts: list[Verdict],
) -> dict[str, Any]:
    """Apply guardrails once at synthesis write time."""
    snapshot = extract_confidence_snapshot(structured)
    if snapshot is None:
        return structured
    guarded = apply_confidence_guardrails(snapshot, verdicts)
    by_dim = {item.dimension.value: item.value for item in guarded.dimensions}
    raw_dims = structured.get("confidence_dimensions")
    if not isinstance(raw_dims, list):
        return structured
    updated = []
    for item in raw_dims:
        if not isinstance(item, dict):
            updated.append(item)
            continue
        dim = item.get("dimension")
        if isinstance(dim, str) and dim in by_dim:
            updated.append({**item, "value": by_dim[dim]})
        else:
            updated.append(item)
    return {**structured, "confidence_dimensions": updated}


def confidence_snapshot_from_debate(
    debate_result: dict[str, Any] | None,
    verdicts: list[Verdict] | None = None,
) -> ConfidenceSnapshot | None:
    structured = (debate_result or {}).get("structured_synthesis")
    if not isinstance(structured, dict):
        return None
    snapshot = extract_confidence_snapshot(structured)
    if snapshot is None:
        return None
    if verdicts:
        return apply_confidence_guardrails(snapshot, verdicts)
    return snapshot


class AppealSynthesis(BaseModel):
    """Structured appeal moderator output — same LLM call as revised synthesis."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=20, max_length=2500)
    confidence_dimensions: list[ConfidenceDimensionScore] = Field(
        default_factory=list,
        max_length=4,
    )

    @field_validator("summary", mode="before")
    @classmethod
    def normalize_summary(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


def appeal_synthesis_to_prose(synthesis: AppealSynthesis) -> str:
    return synthesis.summary.strip()


def confidence_snapshot_from_structured(
    structured: dict[str, Any] | None,
    verdicts: list[Verdict] | None = None,
) -> ConfidenceSnapshot | None:
    snapshot = extract_confidence_snapshot(structured)
    if snapshot is None:
        return None
    if verdicts:
        return apply_confidence_guardrails(snapshot, verdicts)
    return snapshot


def confidence_before_after(
    debate_result: dict[str, Any] | None,
    revised_structured: dict[str, Any] | None,
    *,
    original_verdicts: list[Verdict] | None = None,
    revised_verdicts: list[Verdict] | None = None,
) -> dict[str, Any] | None:
    before = confidence_snapshot_from_debate(debate_result, original_verdicts)
    after = extract_confidence_snapshot(revised_structured)
    if after and revised_verdicts:
        after = apply_confidence_guardrails(after, revised_verdicts)
    if before is None and after is None:
        return None
    return {
        "before": before.model_dump(mode="json") if before else None,
        "after": after.model_dump(mode="json") if after else None,
    }
