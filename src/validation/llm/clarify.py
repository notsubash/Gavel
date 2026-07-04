"""LLM: sharpen a single worksheet field."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from idea_context import wrap_untrusted
from llm_resilience import call_with_llm_retry
from validation.llm import build_assist_model
from validation.llm.prompts import render_validation_prompt, wrap_worksheet_context
from validation.schemas import IdeaWorksheet

_FIELD_LIMITS: dict[str, int] = {
    "working_name": 120,
    "audience": 2000,
    "problem_statement": 4000,
    "current_workaround": 4000,
    "solution_statement": 4000,
    "secret_sauce": 2000,
    "pricing_hypothesis": 2000,
    "existing_evidence": 4000,
    "top_risky_assumption": 1000,
    "disconfirming_evidence": 2000,
    "trigger_event": 1000,
}

VALID_WORKSHEET_FIELDS = frozenset(_FIELD_LIMITS)


class _ClarifyResult(BaseModel):
    clarified_value: str = Field(min_length=1)


def clarify_field(
    field_name: str,
    current_value: str,
    worksheet_context: IdeaWorksheet | None = None,
) -> str:
    if field_name not in VALID_WORKSHEET_FIELDS:
        raise ValueError(f"Unknown field: {field_name}")

    max_len = _FIELD_LIMITS[field_name]
    context_wrapped = None
    if worksheet_context is not None:
        context_wrapped = wrap_worksheet_context(worksheet_context.model_dump_json(indent=2))

    messages = [
        SystemMessage(
            content=render_validation_prompt(
                "validation_clarify_system.jinja2",
                max_length=max_len,
            )
        ),
        HumanMessage(
            content=render_validation_prompt(
                "validation_clarify_user.jinja2",
                field_name=field_name,
                field_value=wrap_untrusted(current_value, field_name),
                worksheet_context=context_wrapped,
            )
        ),
    ]

    model = build_assist_model()
    structured = model.with_structured_output(_ClarifyResult)

    def _invoke() -> _ClarifyResult:
        result = structured.invoke(messages)
        if result is None:
            raise ValueError("LLM returned no clarification")
        return _ClarifyResult.model_validate(result)

    clarified = call_with_llm_retry(_invoke, label="clarify-field")
    value = clarified.clarified_value.strip()
    if len(value) > max_len:
        value = value[:max_len].rstrip()
    return value
