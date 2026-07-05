"""LLM: on-demand weekly validation review digest."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import (
    Assumption,
    Evidence,
    Experiment,
    IdeaWorksheet,
    WeeklyReviewResponse,
)


class _WeeklyReviewResult(BaseModel):
    summary: str = Field(min_length=20, max_length=2000)
    highlights: list[str] = Field(default_factory=list, max_length=6)
    open_questions: list[str] = Field(default_factory=list, max_length=5)


def _recent_evidence(evidence: list[Evidence], *, days: int = 7) -> list[Evidence]:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    recent: list[Evidence] = []
    for item in evidence:
        if item.occurred_at is not None and item.occurred_at >= cutoff:
            recent.append(item)
    return recent


def weekly_review(
    worksheet: IdeaWorksheet,
    assumptions: list[Assumption],
    evidence: list[Evidence],
    experiments: list[Experiment],
    *,
    days: int = 7,
) -> WeeklyReviewResponse:
    model = build_assist_model()
    structured = model.with_structured_output(_WeeklyReviewResult)

    recent_evidence = _recent_evidence(evidence, days=days)
    completed = [e for e in experiments if e.status == "completed"]
    active = [e for e in experiments if e.status == "active"]

    assumption_lines = "\n".join(f"- [{a.status}/{a.type}] {a.statement}" for a in assumptions[:15])
    evidence_lines = (
        "\n".join(f"- [{e.type}/{e.strength}] {e.content[:200]}" for e in recent_evidence[:20])
        or "No evidence logged in the review window."
    )
    experiment_lines = (
        "\n".join(f"- {e.title} ({e.status}, {e.decision})" for e in [*active, *completed][:10])
        or "No experiments."
    )

    messages = [
        SystemMessage(content=render_validation_prompt("validation_weekly_review_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "validation_weekly_review_user.jinja2",
                worksheet=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
                days=days,
                assumptions=wrap_worksheet_context(assumption_lines),
                evidence=wrap_worksheet_context(evidence_lines),
                experiments=wrap_worksheet_context(experiment_lines),
            )
        ),
    ]

    def _invoke() -> _WeeklyReviewResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no weekly review")
        return _WeeklyReviewResult.model_validate(result)

    out = call_with_llm_retry(_invoke, label="weekly-review")
    return WeeklyReviewResponse(
        summary=out.summary,
        highlights=out.highlights,
        open_questions=out.open_questions,
        period_days=days,
        evidence_count=len(recent_evidence),
    )
