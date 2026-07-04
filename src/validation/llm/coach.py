"""LLM: validation coach narrative."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import (
    ChecklistResponse,
    ConfidenceResponse,
    IdeaWorksheet,
    ReadinessResponse,
    ValidationCoachResponse,
    ValidationStage,
)


class _CoachResult(BaseModel):
    narrative: str = Field(min_length=20, max_length=2000)
    suggested_actions: list[str] = Field(default_factory=list, max_length=5)
    focus_stage: ValidationStage | None = None


def validation_coach(
    worksheet: IdeaWorksheet,
    checklist: ChecklistResponse,
    confidence: ConfidenceResponse,
    readiness: ReadinessResponse,
) -> ValidationCoachResponse:
    model = build_assist_model()
    structured = model.with_structured_output(_CoachResult)
    checklist_lines = "\n".join(
        f"- [{'x' if i.completed else ' '}] {i.label}" for i in checklist.items
    )
    confidence_lines = "\n".join(f"- {c.dimension}: {c.label}" for c in confidence.chips)
    messages = [
        SystemMessage(content=render_validation_prompt("validation_coach_system.jinja2")),
        HumanMessage(
            content=render_validation_prompt(
                "validation_coach_user.jinja2",
                worksheet=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
                next_action=checklist.next_action,
                checklist=wrap_worksheet_context(checklist_lines),
                confidence=wrap_worksheet_context(confidence_lines),
                readiness_level=readiness.level,
            )
        ),
    ]

    def _invoke() -> _CoachResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no coach output")
        return _CoachResult.model_validate(result)

    out = call_with_llm_retry(_invoke, label="validation-coach")
    return ValidationCoachResponse(
        narrative=out.narrative,
        suggested_actions=out.suggested_actions,
        focus_stage=out.focus_stage or checklist.next_stage,
    )
