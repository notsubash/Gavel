"""Worksheet version bump rules and field diffs."""

from __future__ import annotations

import difflib

from validation.schemas import IdeaWorksheet

# ponytail: string equality only; no semantic diff. Upgrade: normalize whitespace before compare.
CORE_VERSION_FIELDS = frozenset(
    {
        "audience",
        "problem_statement",
        "solution_statement",
        "secret_sauce",
        "pricing_hypothesis",
        "top_risky_assumption",
    }
)

FIELD_LABELS: dict[str, str] = {
    "working_name": "Working name",
    "audience": "Audience",
    "problem_statement": "Problem statement",
    "current_workaround": "Current workaround",
    "solution_statement": "Solution statement",
    "secret_sauce": "Secret sauce",
    "pricing_hypothesis": "Pricing hypothesis",
    "existing_evidence": "Existing evidence",
    "competitors": "Competitors",
    "top_risky_assumption": "Top risky assumption",
    "disconfirming_evidence": "Disconfirming evidence",
    "trigger_event": "Trigger event",
}


def _field_text(worksheet: IdeaWorksheet, field: str) -> str:
    value = getattr(worksheet, field)
    if field == "competitors":
        return ", ".join(value) if value else ""
    if value is None:
        return ""
    return str(value)


def compute_worksheet_diff(
    before: IdeaWorksheet, after: IdeaWorksheet
) -> list[dict[str, str | bool]]:
    changes: list[dict[str, str | bool]] = []
    for field in FIELD_LABELS:
        old = _field_text(before, field)
        new = _field_text(after, field)
        if old != new:
            changes.append(
                {
                    "field": field,
                    "label": FIELD_LABELS[field],
                    "before": old,
                    "after": new,
                    "is_core": field in CORE_VERSION_FIELDS,
                }
            )
    return changes


def core_fields_changed(diff: list[dict[str, str | bool]]) -> bool:
    return any(bool(item.get("is_core")) for item in diff)


def build_change_summary(diff: list[dict[str, str | bool]]) -> str:
    if not diff:
        return "No field changes"
    labels = [str(item["label"]) for item in diff]
    if len(labels) == 1:
        return f"Updated {labels[0]}"
    return f"Updated {', '.join(labels[:-1])}, and {labels[-1]}"


def should_create_version(diff: list[dict[str, str | bool]], *, minor_edit: bool) -> bool:
    if not diff:
        return False
    if core_fields_changed(diff):
        return not minor_edit
    return False


def validate_minor_edit(diff: list[dict[str, str | bool]]) -> None:
    """Reject substantive core edits disguised as typo fixes."""
    if not core_fields_changed(diff):
        return
    if len(diff) != 1:
        raise ValueError("minor_edit only allowed for single-field typo fixes on core fields")
    before = str(diff[0]["before"])
    after = str(diff[0]["after"])
    # ponytail: similarity ratio; upgrade: explicit Levenshtein threshold per field length
    if difflib.SequenceMatcher(None, before, after).ratio() < 0.92:
        raise ValueError(
            "change too large for minor_edit; uncheck minor edit to create a new version"
        )
