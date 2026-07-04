"""Map legacy flat run requests to structured worksheets."""

from __future__ import annotations

from api.schemas import CreateRunRequest
from validation.schemas import IdeaWorksheet


def _clip(text: str | None, fallback: str, min_len: int, max_len: int) -> str:
    raw = (text or "").strip() or fallback
    if len(raw) < min_len:
        raw = fallback if len(fallback) >= min_len else raw.ljust(min_len, ".")
    return raw[:max_len]


def legacy_request_to_worksheet(request: CreateRunRequest) -> IdeaWorksheet:
    idea = request.idea.strip()
    first_line = idea.split("\n", 1)[0].strip()[:120] or "Untitled Idea"
    audience = _clip(
        request.target_customer,
        "Early-stage founders exploring this idea",
        10,
        2000,
    )
    competitors = [c.strip() for c in (request.competitors or []) if c.strip()][:20]
    return IdeaWorksheet(
        working_name=first_line,
        audience=audience,
        problem_statement=_clip(idea, "The problem is not yet clearly stated.", 10, 4000),
        current_workaround=_clip(
            "Competitors and manual workarounds not specified in legacy intake.",
            "They use spreadsheets, docs, or informal workarounds.",
            10,
            4000,
        ),
        solution_statement=_clip(
            idea,
            "A solution has been proposed but not yet detailed.",
            10,
            4000,
        ),
        secret_sauce=_clip(
            "Differentiation not captured in legacy intake.",
            "Approach differs from incumbents in execution focus.",
            10,
            2000,
        ),
        pricing_hypothesis=_clip(request.pricing, "unknown", 1, 2000),
        existing_evidence=_clip(request.traction, "none yet", 1, 4000),
        competitors=competitors,
        top_risky_assumption=_clip(
            "Demand and willingness to pay must be validated.",
            "Target customers will adopt this solution.",
            10,
            1000,
        ),
        disconfirming_evidence=_clip(
            "Customers show no interest after structured outreach.",
            "Five target users say they would not switch from current workaround.",
            10,
            2000,
        ),
    )
