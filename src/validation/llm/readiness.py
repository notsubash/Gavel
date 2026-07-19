"""LLM: plain-language readiness briefing (verdict stays rule-based)."""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import IdeaWorksheet, ReadinessBriefingResponse, ReadinessResponse

logger = logging.getLogger(__name__)


class _BriefingResult(BaseModel):
    briefing: str = Field(min_length=20, max_length=2000)


def _deterministic_briefing(readiness: ReadinessResponse) -> str:
    """Explain the gate from its own checks — no LLM required."""
    failed = [c.name.replace("_", " ") for c in readiness.checks if not c.passed]
    failed_txt = ", ".join(failed) if failed else "none"

    if readiness.level == "ready":
        text = (
            "Checks passed and you have human evidence on file, so this idea is ready to roast. "
            "Expect judges to pressure-test demand, competition, and your riskiest assumption."
        )
    elif readiness.level == "too_vague":
        text = (
            f"This worksheet is still too vague for a useful roast. Failed checks: {failed_txt}. "
            "Clarify the audience, make the problem distinct from the solution, and fill assumption, "
            "pricing, and evidence fields before running judges."
        )
    else:
        text = (
            "Worksheet structure is good enough to roast, but demand is still speculative without "
            "interview quotes or other human evidence. Roast now knowing the panel will treat traction "
            "as unproven, or add real buyer signal first to reach ready."
        )
        if failed:
            text += f" Outstanding blockers: {failed_txt}."

    if not readiness.can_run_judges:
        text += " Judging is blocked until those gaps are fixed."
    return text


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
                worksheet_json=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
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

    try:
        out = call_with_llm_retry(_invoke, label="readiness-briefing")
        return ReadinessBriefingResponse(briefing=out.briefing)
    except Exception:
        # ponytail: DeepSeek structured output sometimes returns None; gate is already
        # deterministic so explain from checks instead of 503. Upgrade: retry empty
        # structured results in call_with_llm_retry if assists keep flaking.
        logger.warning(
            "readiness-briefing LLM unavailable; using deterministic copy", exc_info=True
        )
        return ReadinessBriefingResponse(briefing=_deterministic_briefing(readiness))
