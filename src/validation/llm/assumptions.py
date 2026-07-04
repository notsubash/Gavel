"""LLM: extract testable assumptions from a worksheet."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import Assumption, AssumptionType, IdeaWorksheet


class _AssumptionDraft(BaseModel):
    statement: str = Field(min_length=10, max_length=500)
    type: AssumptionType = "demand"
    disconfirming_criteria: str | None = Field(default=None, max_length=500)


class _ExtractResult(BaseModel):
    assumptions: list[_AssumptionDraft] = Field(min_length=1, max_length=5)


def extract_assumptions(worksheet: IdeaWorksheet, workspace_id: str) -> list[Assumption]:
    model = build_assist_model()
    structured = model.with_structured_output(_ExtractResult)
    messages = [
        SystemMessage(
            content=render_validation_prompt("validation_extract_assumptions_system.jinja2")
        ),
        HumanMessage(
            content=render_validation_prompt(
                "validation_extract_assumptions_user.jinja2",
                worksheet=wrap_worksheet_context(worksheet.model_dump_json(indent=2)),
            )
        ),
    ]

    def _invoke() -> _ExtractResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no assumptions")
        return _ExtractResult.model_validate(result)

    extracted = call_with_llm_retry(_invoke, label="extract-assumptions")
    return [
        Assumption(
            id="",
            workspace_id=workspace_id,
            statement=item.statement,
            type=item.type,
            disconfirming_criteria=item.disconfirming_criteria,
        )
        for item in extracted.assumptions
    ]
