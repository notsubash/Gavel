"""LLM: summarize interview notes."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from idea_context import wrap_untrusted
from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt
from validation.schemas import Assumption


class _SummarizeResult(BaseModel):
    summary: str = Field(min_length=20, max_length=4000)
    extracted_quotes: list[str] = Field(default_factory=list, max_length=10)
    suggested_assumption_statements: list[str] = Field(default_factory=list, max_length=5)


def summarize_interview(
    notes: str,
    assumptions: list[Assumption],
    *,
    person_label: str | None = None,
    segment: str | None = None,
) -> tuple[str, list[str], list[str]]:
    model = build_assist_model()
    structured = model.with_structured_output(_SummarizeResult)
    assumption_lines = "\n".join(f"- {a.id}: {a.statement}" for a in assumptions)
    messages = [
        SystemMessage(
            content=render_validation_prompt("validation_summarize_interview_system.jinja2")
        ),
        HumanMessage(
            content=render_validation_prompt(
                "validation_summarize_interview_user.jinja2",
                notes=wrap_untrusted(notes, "interview_notes"),
                person_label=person_label or "Unknown",
                segment=segment or "Unspecified",
                assumptions=wrap_untrusted(assumption_lines, "assumptions"),
            )
        ),
    ]

    def _invoke() -> _SummarizeResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no summary")
        return _SummarizeResult.model_validate(result)

    out = call_with_llm_retry(_invoke, label="summarize-interview")
    id_by_statement = {a.statement.lower(): a.id for a in assumptions}
    suggested_ids: list[str] = []
    for stmt in out.suggested_assumption_statements:
        for a in assumptions:
            if a.id not in suggested_ids and (
                stmt.lower() in a.statement.lower() or a.statement.lower() in stmt.lower()
            ):
                suggested_ids.append(a.id)
                break
        else:
            matched = id_by_statement.get(stmt.lower())
            if matched:
                suggested_ids.append(matched)
    return out.summary, out.extracted_quotes, suggested_ids
