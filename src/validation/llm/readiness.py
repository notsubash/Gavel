"""LLM: plain-language readiness briefing (verdict stays rule-based)."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt
from validation.schemas import IdeaWorksheet, ReadinessBriefingResponse, ReadinessResponse


class _BriefingResult(BaseModel):
    briefing: str = Field(min_length=20, max_length=2000)


def readiness_briefing(
    worksheet: IdeaWorksheet,
    readiness: ReadinessResponse,
) -> ReadinessBriefingResponse:
    model = build_assist_model()
    structured = model.with_structured_output(_BriefingResult)
    check_lines = "\n".join(
        f"- [{'pass' if c.passed else 'fail'}] {c.name}: {c.detail or ''}" for c in readiness.checks
    )
    messages = [
        SystemMessage(content=render_validation_prompt("readiness_briefing_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "readiness_briefing_user.jinja2",
                worksheet_json=worksheet.model_dump_json(indent=2),
                readiness_level=readiness.level,
                can_run_judges=readiness.can_run_judges,
                checks=check_lines,
            )
        ),
    ]

    def _invoke() -> _BriefingResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no readiness briefing")
        return _BriefingResult.model_validate(result)

    out = call_with_llm_retry(_invoke, label="readiness-briefing")
    return ReadinessBriefingResponse(briefing=out.briefing)
